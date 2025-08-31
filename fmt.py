import textwrap
import re
import sys
import os

def format_markdown(input_file, width=80):
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    formatted_lines = []
    in_code_block = False

    for line in lines:
        stripped = line.strip()

        if stripped.startswith("```"):
            in_code_block = not in_code_block
            formatted_lines.append(line)
            continue

        if in_code_block or re.match(r'\[.*\]\(.*\)', stripped):
            formatted_lines.append(line)
        elif stripped == '':
            formatted_lines.append(line)
        else:
            wrapped = textwrap.fill(stripped, width=width)
            formatted_lines.append(wrapped + '\n')

    base, ext = os.path.splitext(input_file)
    output_file = f"{base}_fmt.md"

    with open(output_file, 'w', encoding='utf-8') as f:
        f.writelines(formatted_lines)

    print(f"Formatted Markdown saved to: {output_file}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python format_md.py <input_file.md>")
        sys.exit(1)

    input_path = sys.argv[1]
    format_markdown(input_path)
