/* 
The name of the element reflects the usage:
- #<element_name>: id => max one per page
- .<element_name>: class => no limit on the instances per page
*/
const DOM_elements = {};

DOM_elements['#website-header'] = link_to_exclude =>
{
    const links = [
        ['acheronte', '<a href="#">acheronte</a>'],
        ['stige', '<a href="#">stige</a>'],
    ];

    const included_links = new Array(links.length);

    for (let i = 0, j = 0; i < links.length; i++) {
        const [key, value] = links[i];
        if (key !== link_to_exclude) {
            included_links[j] = value;
            j++;
        } 
    }

    return (`
        <!--
        If the script is set to 'type=module', 
        a blinking of color-change may be noticed; 
        So, this script is placed before the HTML of interest
        -->
        <script> 
            const html = document.querySelector("html");
            const color_scheme = localStorage.getItem("color-scheme");
            
            if (color_scheme) {
                // When the page loads, the html element hasn't a color-scheme class by default
                html.classList.add(color_scheme);
            }
        </script>
        <header id="website-header">
            <nav>${included_links.join('')}</nav>
		    <button id="dark-mode-btn">Dark</button>
            <button id="light-mode-btn">Light</button>
        </header>
        <script type="module">
            import { 
                switch_class, 
            } from './assets/_universal.js';

            const light_mode_btn = document.querySelector("#light-mode-btn");
            const dark_mode_btn = document.querySelector("#dark-mode-btn");
            const color_channel = new BroadcastChannel("color-channel");

            light_mode_btn.addEventListener("click", () => {
                switch_class(html, 'dark-mode', 'light-mode');
                localStorage.setItem('color-scheme', 'light-mode');
                color_channel.postMessage('light-mode');
            });

            dark_mode_btn.addEventListener("click", () => {
                switch_class(html, 'light-mode', 'dark-mode');
                localStorage.setItem('color-scheme', 'dark-mode');
                color_channel.postMessage('dark-mode');
            });

            color_channel.onmessage = e => {
                const mode_to_set = e.data;
                const mode_to_remove = mode_to_set === 'dark-mode' ? 'light-mode' : 'dark-mode';
                switch_class(html, mode_to_remove, mode_to_set);
            }
        </script>
    `);
};

DOM_elements['#website-footer'] = curr_page =>
{
    const links = [
        '<a href="https://github.com/AlessandroTambellini/website-template" rel="external" target="_blank">source code</a>',
        // ['sponsor-project', '<a rel="external" target="_blank" href="https://github.com/sponsors/AlessandroTambellini">sponsor project</a>'],
    ];

    if (curr_page !== 'license') {
        links.push('<a rel="license" href="license">LICENSE</a>');
    }

    return (`
        <footer id="website-footer">
            <small>
                ${links.join('')}
            </small>
        </footer>    
    `);
};

DOM_elements['.info-msg'] = msg => `<p class='info-msg'>${msg}</p>`;

/* */

export default DOM_elements;

