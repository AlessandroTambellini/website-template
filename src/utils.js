import { 
    open, 
    readFile, 
    writeFile, 
} from "node:fs/promises";

import errors from './errors.js';

const utils = {};


/*
    serialization / deserialization
*/

// ds := data structure
utils.serialize_ds = ds =>
{
    let serialization_error = null, ds_string = null;

    try {
        ds_string = JSON.stringify(ds, (key, value) => {
			let nested_ds = null;
			if (value instanceof Map) {
				nested_ds = Object.fromEntries(value);
			} else if (value instanceof Set) {
				nested_ds = Array.from(value);
			} else {
				nested_ds = value;
			}
			return nested_ds;
		}, 4);
    } catch (error) {
        serialization_error = true;
        errors.trace_error(error);
    }

    return { serialization_error, ds_string };
};

utils.deserialize_ds = (ds_string, f_trace_error = false) =>
{
    let deserialization_error = null, ds = null;

    try {
        ds = JSON.parse(ds_string);
    } catch (error) {
        /*
        This function is used to convert the payload coming from the client;
        Therefore, in case of error, I want to log it back to the user.
        At the same time, I don't want to log it in the server if it's a client error
        */
        deserialization_error = error.message;
        f_trace_error && errors.trace_error(error);
    }

    return { deserialization_error, ds };
};


/*
    File Operations
*/

utils.touch_file = async filepath =>
{
    await new Promise(callback => 
    {
        open(filepath, 'a').then(file => {            
            file.close();
            callback();
        });
    });
};

utils.read_file = async (filepath, encoding = 'utf8', f_trace_error = false) =>
{
    let fs_error = null, file_content = null;

    try {
        file_content = await readFile(filepath, { encoding });
    } catch (error) {
        fs_error = error;
        f_trace_error && errors.trace_error(error);
    }

    return { fs_error, file_content };
};

utils.write_file = async (filepath, data) =>
{
    let fs_error = null;
    
    try {
        await writeFile(filepath, data);
    } catch (error) {
        fs_error = error;
        errors.trace_error(error);
    }

    return fs_error;
};


/*
    Miscellaneous
*/

utils.log_info = msg =>
{
    console.error(`\x1b[30mINFO\x1b[0m: ${msg}`);
};
  
utils.get_url = (url_string, base = undefined) =>
{
    let url_error = null, url = null;

    try {
        url = new URL(url_string, base);
    } catch (error) {
        url_error = error.message;
    }

    return { url_error, url };
};

/* Reason for the existance of this function:
https://claude.ai/share/770f8684-779c-4239-81b1-2cb1a82c1c11 */
utils.replace_substring = (string, substring_to_replace, replacement) =>
{
    return string.replace(substring_to_replace, () => replacement);
}

/* */

export default utils;
