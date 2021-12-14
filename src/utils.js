export function isInRange(val, ref, precision) {
    const offset = precision / 2;
    return (val >= (ref - offset) && val <= (ref + offset));
}

const max_zoom = 8;
const min_zoom = 2;

const y_scale = 0.000408856;
const y_offset = 6143.7-2;

const x_scale = 0.000408767;
const x_offset = 8192.2;

export function toMapCoords([x, y]) {
    return [ (x-x_offset)/x_scale, (y-y_offset)/y_scale ];
}

export  function toGameCoords([x, y]) {
    return [ (x*x_scale+x_offset), (y*y_scale+y_offset)];
}


export function loadPath() {
    const raw = window.localStorage.getItem('playerPath') || '[]';
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.log('failed to parse stored data', e);
        return [];
    }
}

export function savePath(path) {
    window.localStorage.setItem('playerPath', JSON.stringify(path));
}