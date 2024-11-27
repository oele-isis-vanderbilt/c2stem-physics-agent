# c2stem-physics-agent
Agent implementation for C2STEM physics. Testing waters with an initial local implementation


## Installation

- Clone Repository:

```sh
git clone git@github.com:oele-isis-vanderbilt/c2stem-physics-agent.git
```

- Front End:
  Setup Vue static app.

```sh
cd client
npm install
npm run build
```

- Back End:
  Setup python server with WebSocket.

```sh
cd server
pip install -r requirements.txt
```

## Running locally

```sh
cd server
python main.py
```

```sh
cd client
npm run serve
```

The app should be running on http://locahost:8081.
