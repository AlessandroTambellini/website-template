import path from "node:path";

import data_ops from "./data_ops.js";
import DOM_elements from "./DOM_elements.js";
import utils from "./utils.js";
import errors from './errors.js';

const WEB_INTERFACE_PATH = path.join(import.meta.dirname, 'web_interface');

const RES_REQUESTED_PAGE = page => (
    [200, page, 'text/html']
);

const MSG_GET_PAGE_ERROR = page_name => (
    `Server Error: Unable to get the page '${page_name}' for unknown reason`
);

const handlers = {};

handlers['/'] = async req_data =>
{
    if (req_data.method !== 'GET') {
        return errors.ERR_INVALID_METHOD(req_data.method, req_data.path, 'GET');
    }

    // In this case, req_data.path doesn't match the file name: '/' !== 'index'
    const page_name = 'index';

    const { 
        page_error, 
        page_template, 
    } = await get_page_template(page_name); 

    if (page_error) {
        return [500, fallback_page(MSG_GET_PAGE_ERROR(page_name)), 'text/html'];
    }

    const page = utils.replace_substring(
        build_page(page_template, page_name),
        '{{ cest-time }}',
        new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Rome" })
    );

    return RES_REQUESTED_PAGE(page);
};

handlers['license'] = async req_data =>
{
    if (req_data.method !== 'GET') {
        return errors.ERR_INVALID_METHOD(req_data.method, req_data.path, 'GET');
    }
    
    const page_name = req_data.path;

    const { 
        page_error, 
        page_template, 
    } = await get_page_template(page_name); 

    if (page_error) {
        return [500, fallback_page(MSG_GET_PAGE_ERROR(page_name)), 'text/html'];
    }

    const page = build_page(page_template, page_name);

    return RES_REQUESTED_PAGE(page);
}

/*
What if the user requests '<domain>/get_asset.html'?
The '.html' extension is always stripped out; 
So, the request come as '/get_asset' and this function is called; 
Even if a page is called get_asset.html.
*/
handlers.get_asset = async req_data =>
{
    /* 'get_asset' is called as the last resort, in case the requested path didn't match any of the handlers.
    So, not necessarily the request was made to get an asset. */

    const asset_path = path.join(WEB_INTERFACE_PATH, req_data.path);
    const file_ext = path.extname(asset_path).replace('.', '');

    if (file_ext && req_data.method !== 'GET') {
        return errors.ERR_INVALID_METHOD(req_data.method, req_data.path, 'GET');
    }

    const MIME_types = {
        css: 'text/css',
        js: 'text/javascript',
        ttf: 'font/ttf',
    };

    const essence = MIME_types[file_ext];

    if (file_ext && !essence && 
        // Silence the noisy Chrome requests (favicon and DevTools)
        file_ext !== 'ico' && !asset_path.endsWith('com.chrome.devtools.json')) 
    {
        errors.log_error(`Unhandled file extension '${file_ext}'. Path: '${asset_path}'.`);
    }

    const { 
        fs_error, 
        file_content: asset, 
    } = await utils.read_file(asset_path, 'font/ttf' === essence ? null : 'utf8');

    let res = null;
    if (fs_error) {
        if (fs_error.code === 'ENOENT') {
            res = errors.ERR_CUSTOM(404, `The path '${asset_path}' doesn't exist`);
        } else if (fs_error.code === 'EISDIR') {
            res = errors.ERR_CUSTOM(400, `'${asset_path}' is a directory`);
        } else {
            errors.trace_error(fs_error);
            res = errors.ERR_UNEXPECTED(`While trying to read '${asset_path}' from disk`);
        }
    } else {
        res = [200, asset, essence || 'text/plain'];
    }

    return res;
}

function get_nat(n) 
{
    /*
    String to number conversion is a bit tricky
    - parseInt converts, for instance, '2a' to 2
    - NaN is tricky to manage, indeed there is a specific function to check its presence
    */
    let conversion_error = null, nat = null;
    let n1 = Math.abs(n);
    let n2 = parseInt(n);
    conversion_error = isNaN(n1) || n2 !== n1 || n1.toString() !== n;
    nat = n2;
    return { conversion_error, nat };
}

async function get_page_template(file_name)
{
    const { 
        fs_error, 
        file_content, 
    } = await utils.read_file(path.join(WEB_INTERFACE_PATH, `${file_name}.html`), 'utf8', true);

    return { 
        page_error: fs_error, 
        page_template: file_content, 
    };
}

function build_page(page_template, page_name)
{
    /*
    Purpose of this function:
        Before, I was doing:
        ```
            const page = page_template
                .replace('{{ #website-header }}', DOM_elements['#website-header'](page_name, true))
                .replace('{{ post }}', DOM_elements['.post'](post))
                .replace('{{ #website-footer }}', DOM_elements['#website-footer']())
        ```
        But, what if a post contains the string '{{ #website-footer }}'?
        So, switched to replace '{{ #website-header }}' and '{{ #website-footer }}' before the rest.
        Moreover, didn't want to depend on the order of string replacements and therefore wrote this function.
    */
    return (
        page_template
            .replace('{{ #website-header }}', DOM_elements['#website-header'](page_name))
            .replace('{{ #website-footer }}', DOM_elements['#website-footer']())
    );
}

function fallback_page(msg)
{
    /* 
    One usage of fallback_page is to use it when I'm not able to load the wanted page from disk using readFile()
    Therefore, I don't store this page as an HTML file; Otherwise, I may fall into the same problem.
    */
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="icon" type="image/webp" href="assets/logo.webp">
            <title>Hyperpost / Fallback Page</title>
            <link rel="stylesheet" href="assets/_universal.css">
            <style> 
                h1 {
                    text-align: center;
                }
            </style>
        </head>
        <body>
            ${DOM_elements['#website-header'](null)}

            <h1>Fallback Page</h1>
            ${DOM_elements['.info-msg'](msg)}

            ${DOM_elements['#website-footer']()}
        </body>
        </html>
    `;
}

/* */

export default handlers;
    
