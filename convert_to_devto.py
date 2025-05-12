#!/usr/bin/python3

import re
import sys
import argparse
import yaml


def convert_frontmatter(content):
    frontmatter_match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not frontmatter_match:
        return content
    
    frontmatter_text = frontmatter_match.group(1)
    try:
        frontmatter = yaml.safe_load(frontmatter_text)
    except yaml.YAMLError:
        return content
    
    devto_frontmatter = {
        "title": frontmatter.get("title", ""),
        "published": True,
        "tags": frontmatter.get("tags", []),
    }
    
    if "slug" in frontmatter:
        devto_frontmatter["canonical_url"] = f"https://notes.hatedabamboo.me/{frontmatter['slug']}"
        
    new_frontmatter = "---\n"
    for key, value in devto_frontmatter.items():
        if isinstance(value, list):
            new_frontmatter += f"{key}: {', '.join(value)}\n"
        else:
            new_frontmatter += f"{key}: {value}\n"
    new_frontmatter += "---\n\n"
    
    return re.sub(r'^---\n(.*?)\n---', new_frontmatter, content, flags=re.DOTALL)


def convert_admonitions(content):
    content = re.sub(
        r'!!! quote "([^"]*)"[\r\n]+([\s\S]*?)(?=[\r\n]+[^\ ]|$)',
        r'> **\1**\n> \2',
        content
    )
    
    admonition_types = ["note", "info", "tip", "warning", "danger"]
    for admonition_type in admonition_types:
        content = re.sub(
            r'!!! ' + admonition_type + r' "?([^"]*)"?[\r\n]+([\s\S]*?)(?=[\r\n]+[^\ ]|$)',
            r'{% ' + admonition_type + r' %}\n\1\n\2\n{% end' + admonition_type + r' %}\n',
            content
        )
    
    return content


def convert_images(content):
    content = re.sub(
        r'!\[(.*?)\]\((\.\.\/assets\/(.*?))\)(\{[^}]*\})?',
        r'![image description: \1](\3)',
        content
    )
    
    return content


def convert_code_blocks(content):
    content = re.sub(
        r'```([a-zA-Z0-9]+) title="([^"]*)"',
        r'```\1\n# \2',
        content
    )
    
    return content


def convert_more_separator(content):
    content = content.replace('<!-- more -->', '<!-- excerpt -->')
    
    return content


def convert_mkdocs_to_devto(content):
    content = convert_frontmatter(content)
    content = convert_admonitions(content)
    content = convert_images(content)
    content = convert_code_blocks(content)
    content = convert_more_separator(content)
    
    return content


def main():
    parser = argparse.ArgumentParser(description='Convert Material for MkDocs markdown to dev.to format')
    parser.add_argument('input_file', help='Input markdown file')
    parser.add_argument('-o', '--output', help='Output file (default: stdout)')
    
    args = parser.parse_args()
    
    try:
        with open(args.input_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        converted_content = convert_mkdocs_to_devto(content)
        
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(converted_content)
        else:
            print(converted_content)
            
    except FileNotFoundError:
        print(f"Error: File '{args.input_file}' not found", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
