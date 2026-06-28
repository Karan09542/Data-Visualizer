import * as fabric from 'fabric';
async function test() {
  const result = await fabric.loadSVGFromURL('test.svg');
  console.log(result.objects);
  const img = await fabric.Image.fromURL('test.png', { crossOrigin: 'anonymous' });
  console.log(img);
  const sel = new fabric.ActiveSelection([], {});
  sel.add(img);
}
