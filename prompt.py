#!/usr/bin/env python3
import os
import time

def main():
    # Get the directory where the script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # List of folders and files relative to the script's directory
    entries = [
        'app/dashboard',
        'app/companies'
        'app/api',
        'lib/prompts.ts'
    ]  

    # Path to the starting prompt file
    starting_prompt_path = os.path.join(script_dir, "starting_prompt.txt")

    # get the date when the file was last modified 
    last_modified_time = os.path.getmtime(starting_prompt_path)
    # convert the time to a human readable format, year-month-day hour:minute:second
    
    last_modified_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(last_modified_time))
    # Print the last modified time
    print(f"Last modified time of '{starting_prompt_path}': {last_modified_time}")
    
    # Output file where all file info will be saved
    output_file = os.path.join(script_dir, "prompt.txt")

    # Read the starting prompt file
    try:
        with open(starting_prompt_path, "r", encoding="utf-8") as starting_prompt_file:
            starting_prompt = starting_prompt_file.read()
    except FileNotFoundError:
        print(f"Error: '{starting_prompt_path}' not found. Please ensure the file exists.")
        return
    except Exception as e:
        print(f"Error reading '{starting_prompt_path}': {e}")
        return

    # Buffer to hold the generated file information
    file_info_buffer = []

    # Process each entry in the list
    for entry in entries:
        # Resolve the full path relative to the script's directory
        full_path = os.path.join(script_dir, entry)
        
        # Check if the entry is a file
        if os.path.isfile(full_path):
            # Write the file path (relative to script dir) to the output
            file_info_buffer.append(f"File: {entry}\n")
            file_info_buffer.append("-" * 40 + "\n")
            
            # Read the file's content
            try:
                with open(full_path, "r", encoding="utf-8") as infile:
                    content = infile.read()
            except Exception as e:
                content = f"Error reading file: {e}"
            
            # Write content to buffer
            file_info_buffer.append(content + "\n")
            file_info_buffer.append("-" * 40 + "\n\n")
        
        # Check if the entry is a directory
        elif os.path.isdir(full_path):
            # Walk through the directory recursively
            for root, _, files in os.walk(full_path):
                for file in files:
                    # Get the absolute path of the file
                    file_path = os.path.join(root, file)
                    # Get relative path from script directory
                    rel_path = os.path.relpath(file_path, script_dir)
                    
                    # Write relative file path to buffer
                    file_info_buffer.append(f"File: {rel_path}\n")
                    file_info_buffer.append("-" * 40 + "\n")
                    
                    # Read the file's content
                    try:
                        with open(file_path, "r", encoding="utf-8") as infile:
                            content = infile.read()
                    except Exception as e:
                        content = f"Error reading file: {e}"
                    
                    # Write content to buffer
                    file_info_buffer.append(content + "\n")
                    file_info_buffer.append("-" * 40 + "\n\n")
        
        else:
            print(f"Warning: '{entry}' is not a valid file or directory. Skipping.")

    # Join the file info buffer into a single string
    file_info = "".join(file_info_buffer)

    # Replace the placeholder in the starting prompt with the generated file info
    final_output = starting_prompt.replace("{insert files here}", file_info)

    # Write the final output to prompt.txt
    with open(output_file, "w", encoding="utf-8") as outfile:
        outfile.write(final_output)

    print(f"File information written to '{output_file}'.")

if __name__ == '__main__':
    main()