#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Nephrite contributors
# SPDX-License-Identifier: MIT
"""Generate the independent MIT-licensed Nephrite atlas, without fonts or assets.

Geometry contract: 64 × 88 cell, 56 × 80 face, 8 × 8 extrusion at 45 degrees,
43 columns and two states. Bodies are constructed from these parameters;
no external theme is opened, parsed, traced or embedded.
Run before render-atlas.py.
"""
from pathlib import Path
import math

GREEN, RED, GOLD, INK = '#176747', '#b52f36', '#b58b49', '#203954'

def path(d, color=GREEN, width=2):
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>'

def fill(d, color):
    return f'<path d="{d}" fill="{color}"/>'

def circle(x,y,r,color=GREEN,width=1.8):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="none" stroke="{color}" stroke-width="{width}"/>'

def disc(x,y,r,color):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}"/>'

def group(art,transform):
    return f'<g transform="{transform}">{art}</g>'

def points_rotated(points, angle, center):
    a=math.radians(angle); c,s=math.cos(a),math.sin(a)
    return [(center[0]+(x-center[0])*c-(y-center[1])*s,
             center[1]+(x-center[0])*s+(y-center[1])*c) for x,y in points]

def polygon(points,color):
    return '<polygon points="'+' '.join(f'{x:.3f},{y:.3f}' for x,y in points)+f'" fill="{color}"/>'

# Original brush lettering, defined as strokes on a 32-unit writing square.
# These are drawings of traditional characters, not font outlines.
GLYPHS = {
 '一': ['M3 17Q16 18 29 15'],
 '二': ['M7 9L25 8','M3 25Q16 26 29 23'],
 '三': ['M5 6L27 5','M8 16L24 15','M2 28L30 26'],
 '四': ['M3 4L4 29','M3 4L29 3L28 29','M12 5Q13 18 6 22','M21 5L20 19Q22 22 27 19','M4 28L28 27'],
 '五': ['M4 4L28 3','M15 5L11 27','M5 15L25 14L24 27','M2 29L30 28'],
 '六': ['M14 2L18 7','M3 11L29 10','M12 17Q10 24 4 29','M21 17Q27 23 29 28'],
 '七': ['M2 14L29 9','M15 2L14 25Q15 30 28 26'],
 '八': ['M12 5Q12 21 3 29','M21 4Q22 20 30 28'],
 '九': ['M11 2Q14 20 3 30','M3 12L23 9L21 25Q21 31 30 26'],
 '萬': ['M2 5L30 4','M10 1L10 9','M23 1L22 9','M7 11L7 21','M7 11L26 10L25 21L7 21','M8 16L25 15','M16 10L16 29','M3 31L3 25L29 24L29 31','M11 29L22 28'],
 '東': ['M2 6L30 5','M6 11L6 22','M6 11L27 10L26 22L6 22','M7 17L26 16','M17 1L16 32','M14 22Q10 27 2 30','M19 22Q24 27 31 29'],
 '南': ['M2 6L30 5','M16 1L15 11','M4 32L4 12L29 11L28 32L23 30','M10 15L13 19','M23 14L20 19','M9 21L24 20','M10 26L24 25','M17 20L16 31'],
 '西': ['M2 4L30 3','M4 10L5 30','M4 10L29 9L28 30L5 30','M12 5L12 16Q11 22 6 24','M21 5L20 21L26 21','M5 29L28 28'],
 '北': ['M12 2L12 31','M2 12L12 11','M2 26L11 22','M22 2L21 25Q21 31 29 27L30 22','M29 10L22 16'],
 '中': ['M4 9L5 24','M4 9L29 8L28 24L5 24','M17 1L16 32'],
 '發': ['M4 3L13 3Q11 10 2 14','M7 6L11 10','M20 1Q23 10 31 12','M29 3L25 7','M10 14L24 13','M5 19L13 18L12 23L6 23L5 28L13 27Q13 32 8 32','M20 17L28 16Q27 25 18 31','M18 22Q22 28 31 31'],
}

def glyph(char,x,y,size,color=INK):
    art=''.join(path(d,color,2.25) for d in GLYPHS[char])
    # A fine offset edge gives the brush marks a carved, inky finish.
    return group(art,f'translate({x} {y}) scale({size/32})')

PIPS={
 1:[(36,40)],2:[(36,24),(36,57)],3:[(23,22),(36,40),(49,58)],
 4:[(23,24),(49,24),(23,57),(49,57)],
 5:[(23,22),(49,22),(36,40),(23,58),(49,58)],
 6:[(x,y) for y in (22,40,58) for x in (23,49)],
 7:[(23,19),(36,27),(49,35)]+[(x,y) for y in (49,64) for x in (23,49)],
 8:[(x,y) for y in (18,33,48,63) for x in (23,49)],
 9:[(x,y) for y in (21,41,61) for x in (21,36,51)]}

def dots(n):
    if n==1:
        art=circle(36,40,19,INK,1.2)+circle(36,40,16.2,RED,2.7)+circle(36,40,12.7,INK,.8)
        for angle in range(0,360,45):
            a=math.radians(angle); x=36+8*math.cos(a); y=40+8*math.sin(a)
            art+=circle(round(x,3),round(y,3),3.3,GREEN,1.4)
        return art+disc(36,40,3.3,RED)+disc(35.4,39.3,.9,'#fffdf3')
    art=''
    for i,(x,y) in enumerate(PIPS[n]):
        if n==2: color=GREEN if i==0 else INK
        elif n==3: color=[INK,RED,GREEN][i]
        elif n==5: color=RED if i==2 else INK
        elif n==7: color=RED if i<3 else GREEN
        elif n==9: color=[GREEN,RED,INK][i//3]
        else: color=INK if n==4 else GREEN
        r=6.6 if n<7 else 5.5
        art+=disc(x,y,r,color)+circle(x,y,r-1.6,'#fffdf4',.8)+disc(x,y,1.45,color)
    return art

def bamboo(n):
    if n==1:
        # A kingfisher: blue back, russet breast, folded green wing, long tail.
        return (fill('M36 41Q24 48 22 69L31 59L28 72L38 55Z',GREEN)+
                fill('M28 39Q23 30 29 20Q34 15 41 18Q47 22 45 29L40 42Q36 51 29 48Z',INK)+
                fill('M30 31Q31 40 39 45Q35 51 29 47Q24 41 26 35Z',RED)+
                fill('M32 31Q45 28 43 42Q40 52 32 56Q39 43 32 31Z',GREEN)+
                path('M35 35Q42 39 35 49','#80a58c',.8)+
                fill('M43 23L54 27L43 28Z',GOLD)+disc(39,23,2,'#fffdf4')+disc(39.6,23,1,INK)+
                path('M31 50L29 55M36 49L34 55M20 57Q37 54 50 57',GOLD,1.4)+
                path('M23 57L20 61M46 56L50 52',GREEN,1.2))
    positions=PIPS[n]
    if n==7: positions=[(36,16)]+[(x,y) for y in (31,47,63) for x in (23,49)]
    art=''
    for i,(x,y) in enumerate(positions):
        color=RED if n in (5,7,9) and i==len(positions)//2 else GREEN
        h=21 if n<=4 else 13.5
        art+=f'<rect x="{x-2.5}" y="{y-h/2}" width="5" height="{h}" rx="2.2" fill="{color}"/>'
        art+=path(f'M{x-3.5} {y-h/2+2}h7M{x-3.5} {y+h/2-2}h7',color,1.5)
        art+=path(f'M{x-1} {y-h/2+4}v{h-8}', '#f5f0d9',.7)
        art+=path(f'M{x-3} {y}h6',color,1.3)
    return art

def characters(n):
    return glyph('一二三四五六七八九'[n-1],23,10,26,INK)+glyph('萬',21,43,30,RED)

def wind(char):
    return glyph(char,17,19,38,INK)

def leaf(x,y,dx,dy,color=GREEN):
    return fill(f'M{x} {y}Q{x+dx*.05-dy*.35} {y+dy*.05+dx*.35} {x+dx} {y+dy}Q{x+dx*.45+dy*.3} {y+dy*.45-dx*.3} {x} {y}Z',color)

def blossom(x,y,r,color,petals=5):
    art=''
    for i in range(petals):
        a=2*math.pi*i/petals
        # Filled overlapping petals, each defined in absolute coordinates.
        def pt(rad,side):
            return f'{x+rad*math.sin(a)+side*math.cos(a):.3f},{y-rad*math.cos(a)+side*math.sin(a):.3f}'
        art+=fill(f'M{x},{y}C{pt(r*.55,-r*.7)} {pt(r*1.3,-r*.35)} {pt(r,0)}C{pt(r*1.3,r*.35)} {pt(r*.55,r*.7)} {x},{y}Z',color)
    art+=disc(x,y,r*.24,GOLD)
    for i in range(5):
        a=i*math.pi*2/5; art+=disc(round(x+math.cos(a)*r*.15,3),round(y+math.sin(a)*r*.15,3),.55,'#fff8dc')
    return art

def flower(n):
    if n==0: # plum
        art=path('M24 68Q37 52 34 21M34 48L48 31M32 55L21 43', '#655445',1.7)
        return art+blossom(33,23,8,RED)+blossom(47,33,6.3,'#c15e65')+blossom(23,44,6,RED)+leaf(32,52,11,-4)
    if n==1: # orchid
        art=path('M34 68Q47 45 39 27',GREEN,1.3)
        art+=fill('M34 69Q14 48 20 37Q26 45 34 69M34 69Q49 39 53 44Q47 60 34 69M34 69Q22 28 25 25Q33 41 34 69',GREEN)
        return art+blossom(38,29,8,'#a2688a',3)+blossom(46,40,5.8,'#9a6c94',3)
    if n==2: # chrysanthemum
        art=path('M35 68L37 35',GREEN,1.6)+leaf(36,55,-14,-9)+leaf(36,61,13,-9)
        for i in range(15):
            a=2*math.pi*i/15; x=37+12*math.cos(a); y=31+12*math.sin(a)
            art+=path(f'M37 31Q{37+7*math.cos(a+.2):.3f} {31+7*math.sin(a+.2):.3f} {x:.3f} {y:.3f}',GOLD,2.4)
        return art+disc(37,31,3.2,'#876333')
    art=path('M29 70L31 19M41 68L42 30',GREEN,2.7)
    for y in (30,43,56):
        art+=path(f'M28 {y}h6', '#8ba88b',1.1)+leaf(31,y,-11,-10)+leaf(32,y+3,15,-9)
    return art+leaf(42,44,12,-8)+leaf(42,56,-10,-10)

def season(n):
    # Four small landscape paintings in a consistent ink-and-mineral palette.
    art=path('M19 68Q35 65 53 68', '#b7ad95',.8)
    if n==0:
        art+=path('M25 65Q36 46 43 22M33 46L23 33', '#655445',1.8)
        art+=blossom(43,24,7,'#bd6670')+blossom(25,34,5,'#cf8790')+blossom(35,43,5.3,RED)
        art+=leaf(32,52,15,-6)+leaf(29,58,-8,-8)
    elif n==1:
        art+=disc(47,21,7,'#c7a163')
        art+=path('M36 64Q40 49 35 36',GREEN,1.3)
        art+=fill('M35 40Q20 31 21 48Q32 57 35 40M36 43Q53 31 52 47Q43 56 36 43',GREEN)
        art+=blossom(35,33,10,'#bc6a72',5)
        art+=path('M20 62Q29 59 38 62M35 67Q45 63 53 66',INK,.8)
    elif n==2:
        art+=disc(46,22,7,'#c6aa79')+path('M27 67Q31 49 40 29M33 49L22 40', '#655445',1.5)
        for x,y,r,c in [(39,30,8,RED),(24,40,6,'#c08042'),(32,49,7,'#ae4d35')]:
            art+=fill(f'M{x} {y+r}L{x-r} {y}L{x-3} {y-1}L{x-2} {y-r}L{x+2} {y-3}L{x+r} {y-5}L{x+5} {y+3}Z',c)
    else:
        art+=disc(47,22,6,'#bdc6c8')
        art+=path('M23 66L36 26L50 64',INK,1.3)
        for y,w in [(37,7),(46,11),(56,15)]:
            art+=path(f'M{36-w} {y+4}Q36 {y-3} {36+w} {y+4}',GREEN,2.2)
            art+=path(f'M{36-w} {y+2}Q36 {y-5} {36+w} {y+2}', '#b9c8c3',1.4)
        art+=disc(22,28,1.2,'#8b9d9e')+disc(49,42,1,'#8b9d9e')
    return art

faces={i:dots(i+1) for i in range(9)}
faces.update({24+i:bamboo(i+1) for i in range(9)})
faces.update({15+i:characters(i+1) for i in range(9)})
faces.update({12:wind('東'),11:wind('南'),10:wind('西'),9:wind('北')})
faces[13]=glyph('中',20,16,32,RED)
faces[14]=glyph('發',19,17,34,GREEN)
faces[37]=('<rect x="21" y="17" width="30" height="47" rx="2" fill="none" stroke="'+INK+'" stroke-width="2.3"/>'+
           '<rect x="25" y="21" width="22" height="39" rx=".7" fill="none" stroke="'+INK+'" stroke-width=".7"/>'+path('M23 24V19H28M44 19H49V24M23 57V62H28M44 62H49V57',INK,.8))
faces.update({38+i:flower(i) for i in range(4)})
faces.update({33+i:season(i) for i in range(4)})

# Independent parametric construction: a rounded face extruded down and left.
CELL_W, CELL_H, DEPTH = 64, 88, 8
FACE_W, FACE_H = CELL_W - DEPTH, CELL_H - DEPTH
CORNER = 2

def rounded_polygon(vertices, radius):
    """Quadratic corner fillets computed from the polygon's own vertices."""
    corners = []
    for i, (x, y) in enumerate(vertices):
        previous, following = vertices[i-1], vertices[(i+1) % len(vertices)]
        def towards(point):
            dx, dy = point[0]-x, point[1]-y
            distance = math.hypot(dx, dy)
            return (x + radius*dx/distance, y + radius*dy/distance)
        corners.append((towards(previous), (x,y), towards(following)))
    def xy(point):
        return f'{point[0]:.4f},{point[1]:.4f}'
    result = f'M{xy(corners[0][0])}'
    for entry, vertex, exit in corners:
        result += f'L{xy(entry)}Q{xy(vertex)} {xy(exit)}'
    return result + 'Z'

def body(selected):
    outline = rounded_polygon([(DEPTH,0), (CELL_W,0), (CELL_W,FACE_H),
                               (FACE_W,CELL_H), (0,CELL_H), (0,DEPTH)], CORNER)
    side = '#bac8b7' if selected else '#d5d2c5'
    bottom = '#5c7964' if selected else '#738271'
    face = '#e4edce' if selected else '#fbf8ef'
    edge = '#54754f' if selected else '#7d8276'
    underside = rounded_polygon([(0,CELL_H-2), (DEPTH,FACE_H-2),
                                 (CELL_W,FACE_H-2), (FACE_W,CELL_H),
                                 (2,CELL_H)], 1)
    return (f'<path d="{outline}" fill="{side}"/>'
            f'<path d="{underside}" fill="{bottom}"/>'
            f'<rect x="{DEPTH}" y="0" width="{FACE_W}" height="{FACE_H}" rx="{CORNER}" fill="{face}"/>'
            f'<rect x="{DEPTH+1.2}" y="1.2" width="{FACE_W-2.4}" height="{FACE_H-2.4}" rx="1.4" fill="none" stroke="#ffffff" stroke-opacity=".65" stroke-width="1"/>'
            + (f'<rect x="{DEPTH+3}" y="3" width="{FACE_W-6}" height="{FACE_H-6}" rx="2" fill="none" stroke="#638256" stroke-width="1.5"/>' if selected else '') +
            f'<path d="{outline}" fill="none" stroke="{edge}" stroke-width="1.2"/>')

bodies = ''.join(f'<g id="body-{state}">{body(state == "selected")}</g>'
                 for state in ('normal', 'selected'))
svg = ['<?xml version="1.0" encoding="utf-8"?>',
       '<!-- SPDX-FileCopyrightText: 2026 Nephrite contributors; SPDX-License-Identifier: MIT. Independent parametric bodies and original faces. -->',
       '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="5504" height="352" viewBox="0 0 2752 176">',
       '<defs>', bodies]
for col, art in sorted(faces.items()):
    svg.append(f'<g id="face-{col}">{art}</g>')
svg.append('</defs>')
for row in range(2):
    for col in range(43):
        svg.append(f'<use x="{col*64}" y="{row*88}" xlink:href="#body-{"selected" if row else "normal"}"/>')
        if col in faces:
            svg.append(f'<use x="{col*64}" y="{row*88}" xlink:href="#face-{col}"/>')
svg.append('</svg>')
Path('public/themes/nephrite.svg').write_text('\n'.join(svg) + '\n')
