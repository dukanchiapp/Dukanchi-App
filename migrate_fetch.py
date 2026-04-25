import os, re

def update_file(path):
    if "AuthContext.tsx" in path or "api.ts" in path:
        return # Skip these, will handle manually
    
    with open(path, 'r') as f: content = f.read()
    orig = content
    
    # Remove token fetching
    content = re.sub(r'^\s*const token = localStorage\.getItem\(\'[^\']+\'\)(?: \|\| \'\')?;\n?', '', content, flags=re.MULTILINE)
    content = re.sub(r'^\s*let token = localStorage\.getItem\(\'[^\']+\'\)(?: \|\| \'\')?;\n?', '', content, flags=re.MULTILINE)
    
    # Clean up headers
    replacements = [
        ("headers: { Authorization: `Bearer ${token}` },", ""),
        ("headers: { Authorization: `Bearer ${token}` }", ""),
        ("headers: { 'Authorization': `Bearer ${token}` },", ""),
        ("headers: { 'Authorization': `Bearer ${token}` }", ""),
        ("headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },", "headers: { 'Content-Type': 'application/json' },"),
        ("headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },", "headers: { 'Content-Type': 'application/json' },"),
        ("headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },", ""),
        ("headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }", ""),
        ("'Authorization': `Bearer ${localStorage.getItem('token')}`", ""),
        ("Authorization: `Bearer ${localStorage.getItem('token')}`", ""),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
        
    content = content.replace("headers: {  },", "")
    content = content.replace("headers: {  }", "")
    
    # Inject credentials: 'include'
    content = re.sub(r'fetch\(([^,]+),\s*\{', r"fetch(\1, { credentials: 'include', ", content)
    content = re.sub(r'fetch\(([^,{}]+)\)', r"fetch(\1, { credentials: 'include' })", content)

    if orig != content:
        with open(path, 'w') as f: f.write(content)
        print(f"Updated {path}")

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            update_file(os.path.join(root, file))

for root, dirs, files in os.walk('admin-panel/src'):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            update_file(os.path.join(root, file))
