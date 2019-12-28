let context, worker, animate;

const FREQUENCIES = [
    [1047.0, 1319, 1568, 1760],
    [523.3, 659.3, 784.0, 880.0],
    [261.6, 329.6, 392.0, 440.0],
    [130.8, 164.8, 196.0, 220.0]
]

const state = {
    playing: false,
    grid: [
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null]
    ],
    bar: -1,
    track: [],
    tracks: {},
    loadedTrack: null,
    modal: false,
    trackname: ""
}

const playNotes = notes => {
    notes.filter(n => n).map(freq => {
        const o = context.createOscillator()
        o.frequency.value = Number(freq)
        o.connect(context.destination)
        o.start()
        o.stop(context.currentTime + .25)
    })
}

const view_grid = state => state.grid.map((row, rowIndex) => {
    return row.map((col, colIndex) => {
        const address = `${rowIndex}|${colIndex}|${FREQUENCIES[rowIndex][colIndex]}`
        const bg = !col ? "bg-yellow" : "bg-red"
        const br = colIndex === state.bar && state.playing ? "b--green" : "b--transparent"
        return `<div class="w3 h3 ma1 ba bw2 ${bg} ${br}" onclick="app.run('toggle', '${address}')"></div>`
    }).join("")
}).join("")

const view_modal = state => `
    <section class="modal">
        <section>
            <form class="shadow-1 flex flex-column justify-between bg-near-white">
                <h2>Save your track</h2>
                <label class="db ma2">Save your track (${state.track.length} bars)?</label>
                <input class="db pa2 ma2 ba bw2 b--black br2" name="trackname" required pattern="[A-Za-z][0-9]" title="tracknames only letters and numbers" onchange="app.run('trackname', this.value)" placeholder="trackname (only letters and numbers)"/>
                <button class="ma2 pa1 br2 w-30" type="button" onclick="app.run('save')">Save track</button>
                <button class="ma2 pa1 br2 ma2 w-30" type="reset" onclick="app.run('reset')">Cancel</button>
            </form>
        </section>
    </section>
`

const view_tracks = state => Object.keys(state.tracks).map(trackname => {
    return `
    <article class="pv1 flex justify-end">
        <span>${trackname} (${state.tracks[trackname].length}bars)</span>
        <button class="ph1 br2 ml2" onclick="app.run('load', '${trackname}')">Load</button>
    </article>`
}).join("")

const view = state => `
    <section class="grid">${view_grid(state)}</section>
    <aside class="white flex flex-column justify-between">
        <h2 class="mb2 tr w-100">Audio Tracks</h2>
        <section class="overflow-scroll">${view_tracks(state)}</section>
        <section><canvas id="canvas" width="100%" height="200px"></canvas></section>
    </aside>
    <nav>
        ${state.loadedTrack 
            ? `<button onclick="app.run('playLoaded')">Play '${state.trackname}'</button>` 
            : `<button onclick="app.run('play')">Play</button>
            <button onclick="app.run('stop')">Stop</button>`
        }
        <button onclick="app.run('reset')">Reset</button>
    </nav>
    ${state.modal ? view_modal(state) : ""}`

const update = {
    play: state => {
        if (!context) { context = new AudioContext() }
        worker = new Worker('worker.js')
        worker.onmessage = msg => app.run('tick', msg)
        worker.postMessage('start')
        animate = true
        return Object.assign({}, state, {playing: true})
    },
    stop: state => {
        worker.postMessage('stop')
        worker.terminate()
        worker = undefined
        animate = false
        return Object.assign({}, state, {
            playing: false,
            bar: 0,
            modal: true
        })
    },
    toggle: (state, address) => {
        const [row, col, val] = address.split("|")
        const newGrid = state.grid.slice(0)
        const newVal = !newGrid[row][col] ? val : null
        newGrid[row][col] = newVal
        return Object.assign({}, state, {grid: newGrid})
    },
    tick: (state) => {
        const bar = state.bar === 3 ? 0 : state.bar + 1
        const track = state.track.slice(0)
        const notes = state.grid.map(row => row[bar])
        playNotes(notes)
        track.push(notes)
        return Object.assign({}, state, {bar, track})
    },
    reset: state => {
        if (worker) {
            worker.postMessage('stop')
            worker.terminate()
            worker = undefined
        }

        animate = false

        return Object.assign({}, state, {
            playing: false,
            grid: [
                [null, null, null, null],
                [null, null, null, null],
                [null, null, null, null],
                [null, null, null, null]
            ],
            bar: -1,
            track: [],
            loadedTrack: null,
            modal: false,
            trackname: ""
        })
    },
    trackname: (state, trackname) => Object.assign({}, state, { trackname }),
    save: state => {
        const localTracks = JSON.parse(window.localStorage.getItem('tracks') || "{}")
        localTracks[state.trackname] = state.track
        window.localStorage.setItem('tracks', JSON.stringify(localTracks))
        ws.send(localStorage.getItem('tracks') || "{}")
        return Object.assign({}, state, { modal: false, track: [] })
    },
    tracks: (state, newTracks) => {
        const tracks = Object.assign({}, state.tracks, newTracks)
        return Object.assign({}, state, { tracks })
    },
    load: (state, trackname) => {
        if (!context) { context = new AudioContext() }

        let track = []
        let bar = 0
        while (bar < state.tracks[trackname].length) {
            track.push(state.tracks[trackname].slice(bar, bar += 4))
        }
        
        while(track[track.length - 1].length < 4) {
            track[track.length - 1].push([null, null, null, null])
        }
        
        const loadedTrack = track.map(G => {
            return [
                [G[0][0],G[1][0],G[2][0],G[3][0]],
                [G[0][1],G[1][1],G[2][1],G[3][1]],
                [G[0][2],G[1][2],G[2][2],G[3][2]],
                [G[0][3],G[1][3],G[2][3],G[3][3]]
            ]
        })

        const grid = loadedTrack[0]

        return Object.assign({}, state, {loadedTrack, trackname, grid, bar: 0})
    },
    playLoaded: state => {
        if (!state.loadedTrack.length) { // track has finished playing
            return Object.assign({}, state, {
                grid: [
                    [null, null, null, null],
                    [null, null, null, null],
                    [null, null, null, null],
                    [null, null, null, null]
                ],
                playing: false,
                bar: -1,
                loadedTrack: null,
                trackname: ""
            })
        }

        const notes = state.grid.map(row => row[state.bar])
        
        playNotes(notes)
        
        let newState = {
            bar: state.bar === 3 ? 0 : state.bar + 1,
            playing: true
        }
        
        if (state.bar === 3) {
            const loadedTrack = state.loadedTrack.slice(0)
            const grid = loadedTrack.shift()
            newState = Object.assign(newState, { grid, loadedTrack })
        }

        setTimeout(() => app.run('playLoaded'), 250)
        return Object.assign({}, state, newState)
    }
}

app.start("audio-grid", state, view, update)

/*
 #     # ####### ######   #####  #######  #####  #    # ####### #######  #####  
 #  #  # #       #     # #     # #     # #     # #   #  #          #    #     # 
 #  #  # #       #     # #       #     # #       #  #   #          #    #       
 #  #  # #####   ######   #####  #     # #       ###    #####      #     #####  
 #  #  # #       #     #       # #     # #       #  #   #          #          # 
 #  #  # #       #     # #     # #     # #     # #   #  #          #    #     # 
  ## ##  ####### ######   #####  #######  #####  #    # #######    #     #####  
*/

const ws = new WebSocket('ws://localhost:3000/socket')

ws.onmessage = ({data}) => {
    if (data === 'collect') {
        ws.send(localStorage.getItem('tracks') || "{}")
    } else {
        let newTracks;
        try {
            newTracks = JSON.parse(data)
        } catch (err) {
            console.error(err)
            newTracks = {}
        }
        app.run('tracks', newTracks)
    }
}

/*
  #####     #    #     # #     #    #     #####     
 #     #   # #   ##    # #     #   # #   #     #    
 #        #   #  # #   # #     #  #   #  #          
 #       #     # #  #  # #     # #     #  #####     
 #       ####### #   # #  #   #  #######       #    
 #     # #     # #    ##   # #   #     # #     #    
  #####  #     # #     #    #    #     #  #####  
*/

const canvas = document.getElementById("canvas")
const brush = canvas.getContext("2d")
brush.fillStyle = "#ffb700"
const w = canvas.getAttribute("width")
const h = canvas.getAttribute("height")
const radians = degree => (Math.PI/180) * degree
const draw = () => {
    if (!state.playing) return requestAnimationFrame(draw)
    console.log("OK animate")
}
