/*
Some notes:
- HTML files may contain JS code and JS files may contain HTML. 
So, trying to consider them separately may be misleading, 
would require this program to be more complex and I don't even think is worth it,
considering their intrinsicness. 
Therefore, I count them together: HTML+JS lines. 
- In the line count, empty lines are counted because they are part of the process of reading the code

Compilation: gcc -Wall -Wextra -std=c11 src-info.c -o src-info
Execution: src-info [<directory>]
*/

#include <dirent.h>
#include <errno.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>

#define MAX_PATH_LEN 512
#define MAX_NUM_OF_FILES 512

struct {
    char path[MAX_PATH_LEN];
    size_t lines;
} file_entries[MAX_NUM_OF_FILES];

/* General Stats */
size_t num_of_files = 0;
size_t HTMLJS_lines = 0;
size_t CSS_lines = 0;

/* For printing */
size_t col_w = 0;

void strip_trailing_slashes(char *root_dir, const char *arg);
void walk(char *dir_path);
long count_file_lines(char *path);
void log_error(const char *fmt, ...);

int main(int argc, char **argv)
{
    char root_dir[MAX_PATH_LEN];
    strip_trailing_slashes(root_dir, argc > 1 ? argv[1] : ".");

    walk(root_dir);

    if (num_of_files == 0) {
        printf("No files in '%s'\n", root_dir);
        return 0;
    }

    printf("HTML + CSS + JS files: %zu\n", num_of_files);
    for (size_t i = 0; i < num_of_files; i++) {
        printf("%-*s  %8zu\n", (int)col_w, file_entries[i].path, file_entries[i].lines);
    }

    printf("\n");
    printf("HTML + JS lines: %9zu\n", HTMLJS_lines);
    printf("CSS lines:       %9zu\n", CSS_lines);
    printf("                 ---------\n");
    printf("tot lines:       %9zu\n", HTMLJS_lines + CSS_lines);
    printf("\n");

    return 0;
}

void strip_trailing_slashes(char *root_dir, const char *arg)
{
    strncpy(root_dir, arg, MAX_PATH_LEN - 1);

    /* Strip the trailing slashes */
    size_t len = strlen(root_dir);
    while (len > 1 && root_dir[len - 1] == '/')
        root_dir[--len] = 0;
}

void walk(char *dir_path)
{
    DIR *dir = opendir(dir_path);

    if (!dir) {
        log_error("Unable to open directory '%s'", dir_path);
        exit(1);
    }

    struct dirent *entry;
    while ((entry = readdir(dir)) != NULL) 
    {
        /* Skip . and .. */
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0)
            continue;

        char entry_fullpath[MAX_PATH_LEN];
        snprintf(entry_fullpath, sizeof(entry_fullpath), "%s/%s", dir_path, entry->d_name);
        
        struct stat st;
        if (stat(entry_fullpath, &st) != 0) continue;

        if (S_ISDIR(st.st_mode)) {
            walk(entry_fullpath);                       
        } 
        else if (S_ISREG(st.st_mode)) 
        {
            const char *file_ext = strrchr(entry->d_name, '.');
            if (file_ext && (strcmp(file_ext, ".html") == 0 || strcmp(file_ext, ".css") == 0 || strcmp(file_ext, ".js") == 0 
                // || strcmp(file_ext, ".md") == 0
            )) {
                strncpy(file_entries[num_of_files].path, entry_fullpath, MAX_PATH_LEN - 1);
                size_t file_lines = count_file_lines(entry_fullpath);
                file_entries[num_of_files].lines = file_lines;
                
                if (strcmp(file_ext, ".css") == 0) {
                    CSS_lines += file_lines;
                } else {
                    HTMLJS_lines += file_lines;
                }
                num_of_files++;
    
                size_t fullpath_len = strlen(entry_fullpath);
                if (fullpath_len > col_w) col_w = fullpath_len;
            }
        }
    }

    if (closedir(dir) == -1) {
        log_error("While closing the directory '%s'", dir_path);
        exit(1);
    }
}

ssize_t count_file_lines(char *file_path)
{
    FILE *f = fopen(file_path, "r");
    
    if (!f) {
        log_error("Unable to open file '%s'", file_path);
        return 0;
    }

    size_t num_of_lines = 0;
    char curr_char, prev_char = '\n';
    while ((curr_char = fgetc(f)) != EOF) 
    {
        if (curr_char == '\n') num_of_lines++;
        prev_char = curr_char;
    }

    /* If file is non-empty and last char isn't newline, count final line */
    if (prev_char != '\n' && num_of_lines == 0) num_of_lines = 1;
    else if (prev_char != '\n') num_of_lines++;

    fclose(f);
    return num_of_lines;
}

void log_error(const char *fmt, ...)
{
    va_list args;
    va_start(args, fmt);
    
    fprintf(stderr, "Error: ");
    vfprintf(stderr, fmt, args);
    if (errno) {
        fprintf(stderr, ": %s\n", strerror(errno));
    } else {
        fprintf(stderr, "\n");
    }
    
    va_end(args);
}
