import http from 'node:http';

import handlers from './handlers.js';
import data_ops from './data_ops.js'
import utils from './utils.js';
import errors from './errors.js';

const PORT = 3000;
const PROTOCOL = 'http';

/*
5 MiB is the max storage per origin in localStorage;
So, to play safe (because in localStorage are also saved user preferences and drafts), 
I set 2 MiB as the max buffer size.
*/ 
const MAX_BUFFER_SIZE = 2 * 1024 * 1024;

if (process.argv[1] === import.meta.filename)
{
    const server = http.createServer();

    server.on('request', (req, responder) => 
    {
        responder.on('error', err => {
            errors.log_error('Response error:', err);
        });

        serve_req(req, responder);
    });

    server.on('listening', () => {
        utils.log_info(`Server started on \x1b[92m${PROTOCOL}://localhost:${PORT}\x1b[0m`);
    });

    server.on('error', err => {
        if (err.code === 'EADDRINUSE') {
            errors.log_error('Address in use, retrying.');
            setTimeout(() => {
                server.close();
                server.listen(PORT);
            }, 1000);
        } else if (err.code === 'EACCES') {
            errors.log_error(`Probably ${PORT} is a reserved port`);
        } else {
            errors.log_error('While trying to start the server:', err.message);
        }
    });

    process.on('SIGHUP', signal => shutdown_server(server, signal));
    process.on('SIGINT', signal => shutdown_server(server, signal));
    process.on('SIGTERM', signal => shutdown_server(server, signal));
    
    server.listen(PORT);
}

function serve_req(req, responder)
{
    const body = [];
    let buffer_size = 0;
    let f_abort = false;

    req.on('data', buffer =>
    {
        if (f_abort) return;

        buffer_size += buffer.length;
        if (buffer_size > MAX_BUFFER_SIZE)
        {
            send_response(responder, errors.ERR_CONTENT_TOO_LARGE(`Exceeded the ${MAX_BUFFER_SIZE} bytes limit. Received ${buffer_size} bytes`));
            f_abort = true;
            return;
        }

        body.push(buffer);
    });

    req.on('end', async () =>
    {
        if (f_abort) return;        

        const { 
            url_error, 
            url, 
        } = utils.get_url(req.url, `${PROTOCOL}://localhost:${PORT}`);
        
        if (url_error) {
            send_response(responder, errors.ERR_CUSTOM(400, url_error));
            return;
        }

        const { 
            cookies_error, 
            cookies, 
        } = parse_cookies(req.headers);
        
        if (cookies_error) {
            send_response(responder, errors.ERR_CUSTOM(400, cookies_error));
            return;
        }

        const JSON_payload = Buffer.concat(body).toString() || '{}';
        const { 
            deserialization_error, 
            ds, 
        } = utils.deserialize_ds(JSON_payload);
        
        if (deserialization_error) {
            send_response(res, errors.ERR_CUSTOM(400, deserialization_error));
            return;
        }

        const req_data = {};
        req_data.path = scrub_path(url.pathname);
        req_data.search_params = url.searchParams;
        req_data.method = req.method;
        req_data.cookies = cookies;
        req_data.payload = ds;

        let res_data = null;
        try {
            if (handlers[req_data.path]) {
                res_data = await handlers[req_data.path](req_data);
            } else {
                res_data = await handlers.get_asset(req_data);
            }   
        } catch (error) {
            errors.trace_error(error);
            res_data = errors.ERR_UNEXPECTED(`While handling the request for '${req_data.path}'`);
        }

        send_response(responder, res_data);
    });

    req.on('error', err => {
        errors.log_error('Request error:', err);
        if (!res.headersSent) {
            send_response(responder, errors.ERR_CUSTOM(400, 'Bad request'));
        }
    });
}

function scrub_path(path)
{
    let scrubbed_path = path;

    if (scrubbed_path.length > 1 && scrubbed_path[0] === '/') {
        scrubbed_path = scrubbed_path.slice(1, scrubbed_path.length);
    }

    if (scrubbed_path.endsWith('.html')) {
        scrubbed_path = scrubbed_path.replace('.html', '')
    }
    
    // Remove trailing '/'
    while (scrubbed_path.length > 1 && scrubbed_path.endsWith('/')) {
        scrubbed_path = scrubbed_path.slice(0, scrubbed_path.length-1);
    }

    return scrubbed_path;
}

function parse_cookies(headers)
{
    let cookies_error = null;
    const cookies = {};

    (headers.cookie || '').split(';').forEach(cookie => {
        const [name, value] = cookie.split('=');
        if (name && value) {
            try {
                cookies[name] = decodeURIComponent(value);
            } catch (error) {
                cookies_error = error.message;
            }
        }
    });

    return { cookies_error, cookies };
}

function send_response(responder, res_data)
{
    const response = {
        status_code: res_data[0],
        payload: res_data[1],
        content_type: res_data[2],
    };

    let payload_error = null, payload = null;
    if (response.content_type === 'application/json')
    {
        const { 
            serialization_error, 
            ds_string, 
        } = utils.serialize_ds(response.payload);
        
        // <error> & <data> are mutually exclusive; So, I don't need an if-else 
        payload_error = serialization_error;
        payload = ds_string;
    } else {
        payload = response.payload;
    }

    // `<obj>.writeHead(response.status_code, ...)` and `Buffer.byteLength(payload)` would throw an error in case of wrong type
    if (typeof response.status_code !== 'number' || typeof response.payload === 'number' || payload_error) {
        responder.writeHead(500, { 'Content-Type': 'text/plain' });
        responder.end('Internal Server Error');
        return;
    }

    responder.strictContentLength = true;
    
    const headers = {
        'Content-Length': Buffer.byteLength(payload), 
        'Content-Type': response.content_type,
        'X-Frame-Options': 'SAMEORIGIN',
    };
    if (response.content_type === 'font/ttf') headers['Cache-Control'] = 'public, max-age=31536000';
    
    responder.writeHead(response.status_code, headers);
    responder.end(payload);
}

let f_shutting_down = false;
async function shutdown_server(server, signal)
{
    if (f_shutting_down) return;
    f_shutting_down = true;
    /* 
    Why of the f_shutting_down flag:
    When running with 'node --watch', 
    there is a parent process restarting the child process (this one);
    And, a characteristic of that parent process is that, 
    in case of a shutdown signal from the console,
    it propagates it to the child;
    Therefore, this function is called two times: 
    - propagation from the parent
    - process.on(<signal>, shutdown_server) in this server
    
    More info: https://www.reddit.com/r/node/comments/zddhcb/comment/iz3dkbg/
    */

    const signals = {
        SIGHUP: 1,
        SIGINT: 2,
        SIGTERM: 15,
    };  
 
    utils.log_info(`\x1b[38;5;214mSignal ${signals[signal]}\x1b[0m: Shutting down`);

    if (await data_ops.store_data_to_disk()) {
        utils.log_info('data saved to disk');
    } else {
        errors.log_error('Unable to save data to disk. Shutting down without having saved data to disk');
    }

    server.close(() => {    
        utils.log_info('The server has been shut down');
        /* 
        (128 + n) is a POSIX convetion for when a process is terminated by a signal.
        In this case is a simulation, because the signal is handled and the program exits gracefully;
        So, it has more of a semantic meaning.
        */
        process.exit(128 + signals[signal]);
    });    
}


