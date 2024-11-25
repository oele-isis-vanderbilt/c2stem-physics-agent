import asyncio
import websockets
import json


async def echo(websocket):
    async for message in websocket:
        message = json.loads(message)
        if message['type'] == "action":
            print("C2STEM Action: " + str(message['data']));
        else:
            await websocket.send(message['data'])

async def main():
    async with websockets.serve(echo, "localhost", 8080):
        await asyncio.Future()  # run forever

asyncio.run(main())