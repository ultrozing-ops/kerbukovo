from pathlib import Path

from PIL import Image, ImageDraw

out = Path(__file__).resolve().parents[1] / 'docs' / 'icons'
out.mkdir(parents=True, exist_ok=True)
for size in (180, 192, 512):
    scale = size / 100
    image = Image.new('RGB', (size * 2, size * 2), '#254538')
    draw = ImageDraw.Draw(image)
    def stroke(points, width):
        draw.line([(round(x*scale*2), round(y*scale*2)) for x,y in points],
                  fill='#e4efd6', width=round(width*scale*2), joint='curve')
    stroke([(25,48),(50,34),(75,48),(50,62),(25,48)], 3)
    stroke([(25,58),(50,72),(75,58)], 3)
    stroke([(50,24),(50,44)], 3)
    image.resize((size,size),Image.Resampling.LANCZOS).save(out / f'icon-{size}.png')
