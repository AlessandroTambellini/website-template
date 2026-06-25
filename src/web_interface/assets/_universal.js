function handle_form(form, form_req)
{
    const submit_btn = form.querySelector('button[type=submit]');
    const server_msg = form.querySelector('.server-msg');

    form.addEventListener('submit', async e => 
    {
        e.preventDefault();
        /* Don't allow a new request until the current one isn't concluded */
        submit_btn.disabled = true;
        
        // Check connection before trying to make a request
        if (!navigator.onLine && document.location.hostname !== 'localhost') {
            server_msg.textContent = 'You are offline';
            switch_class(server_msg, 'success', 'error');
            return;
        }
        
        await form_req(server_msg);

        submit_btn.disabled = false;
    });
}

async function req(path, method, search_params, req_payload = undefined)
{
    /*
    req_error is used both for a server error response or a server non-response (e.g. server crash or server unreachable)
    */
    let req_error = null, res_payload = null;

    try {
        const url = search_params ? `${path}?${new URLSearchParams(search_params)}` : path;

        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (req_payload && !['HEAD', 'GET'].includes(options.method)) {
            options.body = JSON.stringify(req_payload);
        }

        const server_res = await fetch(url, options);
        res_payload = await server_res.json();

        if (res_payload.Error) {
            /* On the client-side, for the final user,
            I don't find the error-code (status code) to be useful;
            So, I just use the error msg stored in the payload */
            req_error = res_payload.Error;
        }

    } catch (error) {
        console.error(error);
        req_error = error.message;
    }

    return { req_error, res_payload };
}

function switch_class(element, class_to_remove, class_to_add)
{
    element.classList.remove(class_to_remove);
    element.classList.add(class_to_add);
}

export {
    handle_form,
    req,
    switch_class,
};
