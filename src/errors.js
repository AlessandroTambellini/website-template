const errors = {};

const ERROR_LABEL = '\x1b[1;31mERROR\x1b[0m';

errors.log_error = msg =>
{
    console.error(`${ERROR_LABEL}: ${msg}`);
};

errors.trace_error = error =>
{
    const ROOT = import.meta.dirname;

    const error_lines = error.stack.split('\n');

    const code_stack = [];
    error_lines.forEach(line => {
        if (line.includes('file://')) {
            line = line.replace(`file://${ROOT}`, '');
            code_stack.push(line);
        }
    });

    let message = null;
    // In case of AggregateError, there isn't a direct err.message to access
    if (error instanceof AggregateError) {
        message = 'Aggregated errors:\n';
        for (let i = 0; i < error.errors.length; i++) {
            message += `- ${i}. ${error.errors[i]}\n`;
        }
    } else {
        message = error.message + '\n';
    }

    console.error(`${ERROR_LABEL}: ${message} ${code_stack.join('\n')}`);
};

/*
The errors are ordered based on when they happen cronologically (sketchily)
e.g. Checking if the content of the data from the client is too big, happens before checking the method,
that happens before checking the single search params
*/
errors.ERR_CONTENT_TOO_LARGE = msg => (
    // The official word is 'large', but I prefer long.
    [413, { Error: 'Content too long: ' + msg }, 'application/json']
);
errors.ERR_INVALID_METHOD = (passed_method, path, expected_method) => (
    [405, { Error: `The method '${passed_method}' isn't allowed for path '${path}'. Expected ${expected_method}`}, 'application/json']
);
errors.ERR_MISSING_SEARCH_PARAM = field_name => (
    [400, { Error: `Missing '${field_name}' search param` }, 'application/json']
);
errors.ERR_INVALID_SEARCH_PARAM = (field_name, error) => (
    [400, { Error: `Invalid '${field_name}' search param${error ? `: Error: ${error}` : ''}` }, 'application/json']
);
errors.ERR_MISSING_PAYLOAD_FIELD = field_name => (
    [400, { Error: `Missing '${field_name}' payload field`}, 'application/json']
);
errors.ERR_INVALID_PAYLOAD_FIELD = (field_name, error) => (
    [400, { Error: `Invalid '${field_name}' payload field${error ? ': ' + error : ''}`}, 'application/json']
);
errors.ERR_UNAUTHENTICATED = error_msg => (
    /*
    Although the HTTP standard specifies "unauthorized", 401 semantically means "unauthenticated".
    403 is for "unauthorized": the client's identity is known, but doesn't have the rights to perform a certain action.
    So, 401 is a supcategory of 403.
    */
    [401, { Error: `Unauthenticated: ${error_msg}` }, 'application/json']
);
errors.ERR_UNAUTHORIZED = msg => (
    [403, { Error: `Unauthorized: ${msg}` }, 'application/json']
);
errors.ERR_NOT_FOUND = (entity, field) => (
    [404, { Error: `No ${entity} for the specified ${field}`}, 'application/json']
);
errors.ERR_CONFLICT = msg => (
    [409, { Error: 'Conflicting data: ' + msg }, 'application/json']
);
errors.ERR_UNEXPECTED = msg => (
    [500, { Error: 'An unexpected error has occured in the server: ' + msg }, 'application/json']
);
errors.ERR_UNKNOWN_DB_ERROR = (action, entity) => (
    [500, { Error: `Unknown error: Something went wrong while trying to ${action} the ${entity}` }, 'application/json']
);
errors.ERR_PROXY = error => (
    [502, { Error: 'Something went wrong on your behalf: ' + error }, 'application/json']
);
errors.ERR_CUSTOM = (status_code, error) => (
    [status_code, { Error: error }, 'application/json']
);

/* */

export default errors;
