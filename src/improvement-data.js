import {containerA,containerB,center} from './site-data.js';

const rectangle = (x,z,w,d) => ({x,z,w,d});
export const lawn = [[-53.86,-4.72],[-13.86,-4.72],[-13.86,-13.55],[-2,-11.90],[16,-9.32],
    [26.7,-7.83],[28.2,1.0],[28.0,7.12],[21.7,8.56],[18.1,9.79],[5.64,10.72],[-53.86,14.67]];
export const pitch = rectangle(-52.0,.70,21.55,10.75);
export const playground = rectangle(-27.1,3.70,12.0,8.15);
export const grill = rectangle(3.12,3.28,8.42,6.04);
export const canopy = rectangle(containerA.x,containerB.z+containerB.d,containerA.w,
    containerA.z-containerB.z-containerB.d);
export const cars = [{x:canopy.x+3.05,z:canopy.z+canopy.d/2,color:'#1f68ad'},
    {x:canopy.x+8.86,z:canopy.z+canopy.d/2,color:'#171b1d'}];
export const paths = [
    {width:1.43, points:[[-30.33,2.30],[-28.28,2.32],[-20.44,2.10],[-12.0,2.1],[-6.2,1.72],
        [1.0,1.64],[7.0,1.69],[14.0,2.17],[18.4,1.86],[24.3,.30],[30.2,-1.62],
        [38.5,-1.58],[44.65,-1.56],[46.0,-.96],[46.50,1.91],[48.4,3.30],[54.05,3.60]]},
    {width:1.05,points:[[-10.23,2.13],[-10.20,1.35],[-10.20,.73]]},
    {width:1.04,points:[[-25.11,2.17],[-25.11,1.34],[-25.11,.72]]},
    {width:1.03,points:[[-21.75,2.16],[-21.74,2.93],[-21.77,3.91]]},
    {width:1.13,points:[[7.0,1.71],[7.05,2.60],[7.1,3.35]]},
    {width:.91,points:[[24.3,.30],[24.48,3.02],[25.78,5.67],[26.39,7.92]]},
];
export const hedge = [{x:53.44,from:-4.76,to:-.64},{x:53.44,from:7.0,to:10.40}];
export const treePositions = [[-48.7,-3.20,4.9],[-39.0,-2.90,4.5],[-31.7,-3.49,4.7],
    [-44.6,12.68,4.6],[-33.2,12.2,3.6],[-29.15,6.8,4.25],[-13.2,8.9,5.5],[-7.1,8.9,4.5],
    [.6,7.8,4.9],[15.0,7.0,5.0],[16.9,-2.3,4.45],[26.1,-4.8,3.8]];
export const walkwayLights = [[-29.05,1.32],[-22.5,1.28],[-16.25,1.27],[-10.7,3.03],[-5.3,.75],[1.38,.7],
    [7.84,.78],[14.86,3.06],[20.86,2.37],[27.73,.05],[34.45,-2.52],[42.0,-2.50],[46.96,-.36],[49.26,4.47]];
export const improvementObjects = [
    {id:'field',name:'Футбольная площадка',detail:'Мини-поле · 20 × 10 м по разметке',icon:'ball',at:center(pitch),size:15,approach:[.94,-.78]},
    {id:'playground',name:'Игровая и качели',detail:'Горка, песочница и двойные качели',icon:'swing',at:center(playground),size:9,approach:[.56,-.95]},
    {id:'grill',name:'Гриль-зона',detail:'Стол под перголой и площадка для гриля',icon:'flame',at:center(grill),size:7,approach:[.80,-1]},
    {id:'canopy',name:'Навес и две машины',detail:'Синяя и чёрная · между контейнерами',icon:'car',at:center(canopy),size:11,approach:[1.10,0]},
    {id:'garden',name:'Газоны и кустарник',detail:'Посадки вдоль правого забора',icon:'tree',at:{x:52.6,z:7.8},size:8,approach:[-.84,-.51]},
];
