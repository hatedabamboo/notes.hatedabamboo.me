#!/usr/bin/env python3

import re
import sys
from pathlib import Path

DOMAIN = "https://notes.hatedabamboo.me"


def extract_frontmatter(content: str) -> tuple[dict, str]:
    """Extract YAML frontmatter and return it with remaining content."""
    pattern = r'^---\s*\n(.*?)\n---\s*\n(.*)$'
    match = re.match(pattern, content, re.DOTALL)

    if not match:
        return {}, content

    frontmatter_text = match.group(1)
    body = match.group(2)

    frontmatter = {}

    title_match = re.search(r'^title:\s*["\']?(.*?)["\']?\s*$', frontmatter_text, re.MULTILINE)
    if title_match:
        frontmatter['title'] = title_match.group(1).strip('"\'')

    date_match = re.search(r'^date:\s*(.+)$', frontmatter_text, re.MULTILINE)
    if date_match:
        frontmatter['date'] = date_match.group(1).strip()

    tags_match = re.search(r'^tags:\s*\n((?:  - .+\n?)+)', frontmatter_text, re.MULTILINE)
    if tags_match:
        tags_text = tags_match.group(1)
        tags = re.findall(r'  - (.+)', tags_text)
        frontmatter['tags'] = [tag.strip() for tag in tags]

    permalink_match = re.search(r'^permalink:\s*(.+)$', frontmatter_text, re.MULTILINE)
    if permalink_match:
        frontmatter['permalink'] = permalink_match.group(1).strip()

    return frontmatter, body


def create_devto_frontmatter(frontmatter: dict) -> str:
    """Create dev.to compatible frontmatter."""
    lines = ['---']

    if 'title' in frontmatter:
        lines.append(f'title: {frontmatter["title"]}')

    if 'date' in frontmatter:
        lines.append('published: true')
        lines.append(f'date: {frontmatter["date"]}')

    if 'tags' in frontmatter:
        tags_str = ', '.join(frontmatter['tags'])
        lines.append(f'tags: {tags_str}')

    if 'permalink' in frontmatter:
        lines.append(f"canonical_url: {DOMAIN}{frontmatter['permalink']}")

    lines.append('---')
    return '\n'.join(lines)


def handle_excerpt_marker(content: str) -> str:
    """Remove or handle <!-- more --> excerpt markers."""
    return re.sub(r'<!--\s*more\s*-->', '', content)


def fix_image_links(content: str, domain: str) -> str:
    """Convert relative image links to absolute URLs."""
    pattern = r'!\[([^\]]*)\]\((/[^\)]+)\)'

    def replace_image(match):
        alt_text = match.group(1)
        path = match.group(2)
        return f'![{alt_text}]({domain}{path})'

    return re.sub(pattern, replace_image, content)


def convert_admonitions(content: str) -> str:
    """Convert admonitions to blockquotes."""
    pattern = r':::\s*(\w+)\s*\n(.*?)\n:::'

    def replace_admonition(match):
        admonition_type = match.group(1)
        admonition_content = match.group(2).strip()

        lines = admonition_content.split('\n')
        quoted_lines = [f'> {line}' if line else '>' for line in lines]

        result = [f'> **{admonition_type.upper()}**'] + quoted_lines

        return '\n'.join(result)

    return re.sub(pattern, replace_admonition, content, flags=re.DOTALL)


def convert_markdown(input_content: str, domain: str = DOMAIN) -> str:
    """Main conversion function."""
    frontmatter, body = extract_frontmatter(input_content)

    body = handle_excerpt_marker(body)
    body = fix_image_links(body, domain)
    body = convert_admonitions(body)

    new_frontmatter = create_devto_frontmatter(frontmatter)

    return f'{new_frontmatter}\n\n{body.strip()}\n'


def main():
    """CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage: python convert.py <input_file> [output_file] [domain]")
        print(f"Current domain: {DOMAIN}")
        sys.exit(1)

    input_file = Path(sys.argv[1])
    output_file = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    domain = sys.argv[3] if len(sys.argv) > 3 else DOMAIN

    if not input_file.exists():
        print(f"Error: Input file '{input_file}' not found")
        sys.exit(1)

    with open(input_file, 'r', encoding='utf-8') as f:
        input_content = f.read()

    output_content = convert_markdown(input_content, domain)

    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(output_content)
        print(f"Converted markdown written to: {output_file}")
    else:
        print(output_content)


if __name__ == '__main__':
    main()
