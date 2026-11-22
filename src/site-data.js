const scale = (1523 - 37) / 109;
const toX = (x) => (x - 37) / scale - 54.5;
const toZ = (y) => (y - 350) / scale;
const point = (x, y) => ({x: toX(x), z: toZ(y)});
const footprint = (x, y, width, depth) => ({...point(x, y), w: width, d: depth});

export const boundary = [[37,259], [583,259], [583,151], [1433,272], [1523,272],
    [1523,503], [866,503], [37,558]].map(([x,y]) => point(x,y));
export const gate = [point(1523,359), point(1523,437)];
export const house = footprint(623,230,8,8.5);
export const porchDepth = 2.15;
export const bath = footprint(623 - 14 * scale,313,4,5);
export const containerA = footprint(1223,455,12,2.55);
export const containerB = {...containerA,z: containerA.z - 4.5 - containerA.d};
export const cabin = footprint(1223 - 9 * scale,503 - 3.1 * scale,4,2);
export const well = point(1205,487);
export const entry = {x: house.x + house.w / 2, z: house.z};
export const pole = point(1523 - 4 * scale,503 - 4 * scale);
export const trees = [[72,536,13.2], [119,532,14.1], [166,529,12.5]].map(([x,y,h]) => ({...point(x,y),h}));
export const surfaces = {gravel: containerA.x - 2, black: containerA.x - 8};
export const water = [well,point(761,202),{x: entry.x, z: toZ(202)},entry];
export const waterLength = water.slice(1).reduce((sum,b,i) => sum + Math.hypot(b.x - water[i].x,b.z - water[i].z),0);
export const electricEnd = {x: containerA.x + containerA.w,z: containerA.z};
export const heightAt = (x) => -2 + (x + 54.5) * 2 / 109;
export const center = ({x,z,w,d}) => ({x: x + w / 2,z: z + d / 2});

export function withinPlot(x,z) {
    let inside = false;
    for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
        const a = boundary[i], b = boundary[j];
        if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
}

export function contains(box,x,z,padding=0) {
    return x > box.x - padding && x < box.x + box.w + padding
        && z > box.z - padding && z < box.z + box.d + padding;
}

export const objects = [
    {id:'house',name:'Дом',detail:'8 × 8,5 м вместе с крыльцом',icon:'house',at:center(house),size:9},
    {id:'bath',name:'Баня',detail:'4 × 5 м · 10 м до стены дома',icon:'house',at:center(bath),size:7},
    {id:'containers',name:'Два контейнера',detail:'Синие · зазор 4,5 м',icon:'container',at:{x:containerA.x+6,z:(containerA.z+containerB.z+containerA.d)/2},size:13},
    {id:'cabin',name:'Бытовка',detail:'4 × 2 м · 5 м от контейнера',icon:'house',at:center(cabin),size:5},
    {id:'well',name:'Скважина и ввод',detail:'Траншея ≈ ' + Math.round(waterLength) + ' м · до дна 1,50 м',icon:'water',at:well,size:6},
    {id:'pole',name:'Электроопора и СИП',detail:'4 м от нижнего забора',icon:'bolt',at:pole,size:9},
    {id:'trees',name:'Три ели',detail:'Вдоль левой нижней границы',icon:'tree',at:trees[1],size:12},
];
