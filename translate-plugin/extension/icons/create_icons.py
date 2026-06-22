#!/usr/bin/env python3
"""生成简单的SVG图标"""

icons = {
    "icon16.png": '''<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
      <rect width="16" height="16" rx="3" fill="url(#g)"/>
      <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#667eea"/><stop offset="100%" stop-color="#764ba2"/></linearGradient></defs>
      <text x="8" y="12" font-size="10" fill="white" text-anchor="middle" font-family="Arial">译</text>
    </svg>''',
    "icon48.png": '''<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">
      <rect width="48" height="48" rx="8" fill="url(#g)"/>
      <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#667eea"/><stop offset="100%" stop-color="#764ba2"/></linearGradient></defs>
      <text x="24" y="36" font-size="28" fill="white" text-anchor="middle" font-family="Arial" font-weight="bold">译</text>
    </svg>''',
    "icon128.png": '''<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
      <rect width="128" height="128" rx="20" fill="url(#g)"/>
      <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#667eea"/><stop offset="100%" stop-color="#764ba2"/></linearGradient></defs>
      <text x="64" y="95" font-size="80" fill="white" text-anchor="middle" font-family="Arial" font-weight="bold">译</text>
    </svg>'''
}

for filename, svg in icons.items():
    with open(filename.replace('.png', '.svg'), 'w') as f:
        f.write(svg)
    print(f"Created {filename.replace('.png', '.svg')}")

print("\n注意: 浏览器扩展需要PNG格式的图标。")
print("你可以使用在线工具将SVG转换为PNG，或者使用以下Python代码:")
print("  pip install cairosvg")
print("  cairosvg icon16.svg -o icon16.png")
