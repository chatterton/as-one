import React, { useEffect, useState } from 'react'
import logger from './logger'
import PropTypes from 'prop-types'
import { Layer, Rect, Stage } from 'react-konva'
import { useCheckedWidth } from './hooks'
import scoreboardAddressTable from './scoreboard-lookup.json'
import MQTT from 'mqtt'

const SCOREBOARD_WIDTH = 31
const SCOREBOARD_HEIGHT = 10
const GREYISH_BLACK = '#222222'

function ScoreboardEmulator (props) {
  const address = props.address

  const [started, setStarted] = useState(false)
  const [leds, setLeds] = useState([])
  const [board, setBoard] = useState([])
  const [ref, checkedWidth] = useCheckedWidth()

  function _rgbToHex (r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
  }

  function _locationToKey (x, y) {
    return 'key_' + x + '_' + y
  }

  function _pixelSize (divWidth) {
    return divWidth / SCOREBOARD_WIDTH
  }

  // Should run only at mount time
  useEffect(() => {
    async function subscribe () {
      const mqtt = MQTT.connect(address)
      try {
        await mqtt.subscribeAsync('asOne/score/all/direct')
        logger.log('subscribed scoreboardemulator')
      } catch (e) {
        logger.error('error connecting to mqtt')
        logger.error(e)
      }

      mqtt.on('message', function (_, message) {
        setLeds(message)
      })
    }

    if (!started) {
      subscribe().then()
      setStarted(true)
    }
  }, [started, address])

  // Runs whenever new raw values are set. Updates the existing screen
  useEffect(() => {
    if (leds) {
      // First, process the incoming rgb values into an array of hex triplets
      const processedArray = []
      for (let i = 0; i < leds.length; i += 3) {
        const brightnessPercentage = (leds[i] + leds[i + 1] + leds[i + 2]) / (255 * 3)
        // Magic number threshold below which the pixel will be shown as dim grey
        if (brightnessPercentage > 0.1) {
          const newColor = _rgbToHex(leds[i], leds[i + 1], leds[i + 2])
          processedArray.push(newColor)
        } else {
          processedArray.push(GREYISH_BLACK)
        }
      }

      // Then, use those to update the board
      const pixelSize = _pixelSize(checkedWidth)
      processedArray.map(function (value, index) {
        const x = scoreboardAddressTable[index].x
        const y = scoreboardAddressTable[index].y
        board[x][y] = (
          <Rect
            x={pixelSize * x}
            y={pixelSize * y}
            width={pixelSize}
            height={pixelSize}
            fill={value}
            key={_locationToKey(x, y)}
          />
        )
        return value
      })
      setBoard(board)
    }
  }, [leds, board, checkedWidth])

  // Runs whenever the screen is resized. Sets the width we're rendering to
  // and creates a screen using that size
  useEffect(() => {
    // using that value, create the board
    const pixelSize = _pixelSize(checkedWidth)
    const screen = []
    for (let i = 0; i < SCOREBOARD_WIDTH; i++) {
      const column = []
      for (let j = 0; j < SCOREBOARD_HEIGHT; j++) {
        const pixel = <Rect x={pixelSize * i} y={pixelSize * j} width={pixelSize} height={pixelSize} fill={GREYISH_BLACK} key={_locationToKey(i, j)} />
        column.push(pixel)
      }
      screen.push(column)
    }
    setBoard(screen)
  }, [checkedWidth])

  //console.log("scoreboardemu checkedwidth: "+checkedWidth)

  return (
    <div ref={ref}>
      <Stage width={checkedWidth} height={checkedWidth / 3}>
        <Layer>
          {board.flat()}
        </Layer>
      </Stage>
    </div>
  )
}

ScoreboardEmulator.propTypes = {
  address: PropTypes.string
}

export { ScoreboardEmulator, GREYISH_BLACK }
