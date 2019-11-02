let interval;

onmessage = msg => {
    if (msg.data === 'stop') { clearInterval(interval) }
    if (msg.data === 'start') { 
        interval = setInterval(() => postMessage('tick'), 250)
     }
}