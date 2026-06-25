import path from "node:path";
import crypto from 'node:crypto';

import utils from "./utils.js";
import errors from './errors.js';

const DATA_PATH = path.join(import.meta.dirname, '..', 'data.json');

const data = await retrieve_data_from_disk() || { /* Default data */ };

/*
Note: there are many ways the data can be corrupted by hand (e.g. by removing or modifying fields), 
and I'll not check it. I simply perform the following check because sometimes, by clearing the file manually, 
some space char (' ') remains there
*/
if (typeof data !== 'object' || data instanceof Array) {
    errors.log_error("Corrupted data");
    process.exit(1);
} else {
    utils.log_info('data retrieved from disk');
}

const data_ops = {};

/* */

/*
data is written to disk before, and only before, shutting down the server;
And, in case of error, I simply log it to the console
*/
data_ops.store_data_to_disk = async () =>
{
    let is_data_saved = false;

    const { 
        serialization_error, 
        ds_string, 
    } = utils.serialize_ds(data);        

    if (serialization_error) {
        utils.log_info(`data: ${data}`);
    } else {
        const fs_error = await utils.write_file(DATA_PATH, ds_string);
        if (!fs_error) is_data_saved = true;
    }

    return is_data_saved;
};

async function retrieve_data_from_disk()
{
    await utils.touch_file(DATA_PATH);

    const { 
        fs_error, 
        file_content: data_string, 
    } = await utils.read_file(DATA_PATH, 'utf8', true);

    if (fs_error) {
        process.exit(1);
    }

    if (data_string.length > 0) {
        /* 
        I don't use the serialize function of utils.js for two reasons:
        - In case the data is corrupted, I *want* to crash 
        - This conversion has data-specific type conversions
        */
        return JSON.parse(data_string, (key, value) => {
            let ds = null;
            if (['users', 'tokens'].includes(key)) {				
                ds = new Map(Object.entries(value));
            } else if (['website_hrefs', 'post_ids'].includes(key)) {
                ds = new Set(value);
            } else {
                ds = value;
            }
            return ds;
        });
    }
}

/* */

export default data_ops;
