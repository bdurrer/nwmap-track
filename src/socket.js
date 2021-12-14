import drawMap from './map';

let isRecording = true;

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

function isInRange(val, ref, precision) {
    const offset = precision / 2;
    return (val >= (ref - offset) && val <= (ref + offset));
}

function init(trackedPlayer, precision = 0.5) {
    const path = loadPath();
    console.log('path initialized with', path.length, 'waypoints');

    function onWsEvent(event) {
        if (!isRecording) {
            return;
        }

        const data = JSON.parse(event.data);
        if (!data || data.type !== 'LOCAL_POSITION_UPDATE') {
            console.log('not a position update', event.data);
            return;
        }

        if (data.playerName !== trackedPlayer) {
            return;
        }

        const [x, y] = data.position;
        if (path.length) {
            const [lastX, lastY] = path[path.length - 1];

            if (isInRange(x, lastX, precision) && isInRange(y, lastY, precision)) {
                return;
            }
        }

        path.push([x, y]);
        document.getElementById('status').innerHTML = `${path.length} waypoints on record`;
    }


    function save() {
        console.log('saving', path.length, 'waypoints');
        savePath(path);
    }

    setInterval(save, 30000);

    const ws = new WebSocket('wss://localhost.newworldminimap.com:42224/Location');
    ws.onmessage = onWsEvent;
}
