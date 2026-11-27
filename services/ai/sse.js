// Reads a server-sent event stream (a fetch response body) -> the data of each
// event, as text.
async function* sseData(body) {
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of body) {
        buffer += decoder.decode(chunk, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop();
        for (const event of events) {
            const data = event
                .split(/\r?\n/)
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice(5).trimStart())
                .join('\n');
            if (data) yield data;
        }
    }
}

module.exports = { sseData };
