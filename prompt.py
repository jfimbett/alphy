#!/usr/bin/env python3
import os

def main():
    # List the folder names (located in the same directory as this script)
    folders = [
               'components',
               ]  

    # Output file where all file info will be saved
    output_file = "prompt.txt"

    # Open the output file for writing
    with open(output_file, "w", encoding="utf-8") as outfile:
        # Process each folder in the list
        for folder in folders:

            # if folder is just a file read it 
            if os.path.isfile(folder):
                # Write the file path to the output file
                outfile.write(f"File: {folder}\n")
                outfile.write("-" * 40 + "\n")

                # Read the file's content ("code")
                try:
                    with open(folder, "r", encoding="utf-8") as infile:
                        content = infile.read()
                except Exception as e:
                    content = f"Error reading file: {e}"

                # Write the content to the output file
                outfile.write(content + "\n")
                outfile.write("-" * 40 + "\n\n")
                continue

            if not os.path.isdir(folder):
                print(f"Warning: '{folder}' is not a valid folder. Skipping.")
                continue

            # Walk through the folder recursively
            for root, _, files in os.walk(folder):
                for file in files:
                    # Create the relative path for the file (including extension)
                    relative_path = os.path.join(root, file)

                    # Write the file path to the output file
                    outfile.write(f"File: {relative_path}\n")
                    outfile.write("-" * 40 + "\n")

                    # Read the file's content ("code")
                    try:
                        with open(relative_path, "r", encoding="utf-8") as infile:
                            content = infile.read()
                    except Exception as e:
                        content = f"Error reading file: {e}"

                    # Write the content to the output file
                    outfile.write(content + "\n")
                    outfile.write("-" * 40 + "\n\n")

    print(f"File information written to '{output_file}'.")

if __name__ == '__main__':
    main()
