import React, { useState, useEffect, useRef } from 'react'
import { useCheckedWidth } from './hooks'
import useInterval from '@restart/hooks/useInterval'
import logger from './logger'
import { Charts, ChartContainer, ChartRow, YAxis, LineChart } from 'react-timeseries-charts'
import { TimeSeries, TimeRange } from 'pondjs'
import PropTypes from 'prop-types'
import MQTT from 'mqtt'
import Ring from 'ringjs'

SensorData.propTypes = {
  name: PropTypes.string.isRequired,
  address: PropTypes.string.isRequired
}

const GRAPH_AREA_PX = 125
const RING_SIZE = 300

function SensorData (props) {
  const address = props.address
  const name = props.name

  const [latestNow, setLatestNow] = useState((new Date()).valueOf())
  const [ref, checkedWidth] = useCheckedWidth()
  const [position, setPosition] = useState('')

  // use ref rather than state. useInterval is going to update the display
  // so there is not a good reason to force another potential update whenever
  // the buffer changes
  const ringRef = useRef(new Ring(RING_SIZE))
  const lastTimeRef = useRef(-Infinity)
  const bufferRef = useRef([])
  const currentBuf = bufferRef.current

  useInterval(() => {
    const pending = currentBuf.splice(0, currentBuf.length)
    const ring = ringRef.current
    for (const point of pending) {
      if (!Number.isFinite(point[0])) continue // malformed timestamp
      if (point[0] < lastTimeRef.current) {
        // timestamps out of order, a rare thing sent by the server from time to time
        logger.log(`sensor ${name}: non-chronological reading (${point[0]} < ${lastTimeRef.current}), skipping`)
        continue
      }
      ring.push(point)
      lastTimeRef.current = point[0]
    }
    setLatestNow((new Date()).valueOf())
  }, 100)

  // Initializer. Should only run at mount, but contains a message handler
  // that pushes all of the state updates into the buffer
  useEffect(() => {
    const mqtt = MQTT.connect(address)
    mqtt.subscribeAsync('asOne/sensor/reading')
      .then(() => logger.log('subscribed sensor monitor'))
      .catch(e => {
        logger.error('error connecting to mqtt')
        logger.error(e)
      })

    mqtt.on('message', (_, message) => {
      if (message == null) return
      const msgString = message.toString()
      const reading = msgString.split(',')
      if (reading[0] !== name) return
      const point = [parseInt(reading[5]), reading[1], reading[2], reading[3], reading[4]]
      currentBuf.push(point)
      setPosition(reading[6])
    })

    return () => mqtt.end(true)
  }, [address, currentBuf, name, setPosition])

  const style = {
    s1: {
      stroke: '#ff0000',
      opacity: 0.75
    },
    s2: {
      stroke: '#bbffbb',
      opacity: 0.75
    },
    s3: {
      stroke: '#00bbff',
      opacity: 0.75
    },
    s4: {
      stroke: '#bbbbbb',
      opacity: 0.75
    }
  }

  const dataArray = ringRef.current.toArray()
  const sum = (dataArray.length < 2)
    ? 1
    : dataArray.map(function (value) {
      return parseInt(value[1]) + parseInt(value[2]) + parseInt(value[3]) + parseInt(value[4])
    }).reduce(function (accumulator, value) {
      return accumulator + value
    })
  const average = (dataArray.length < 2) ? 1 : (sum / dataArray.length) / 4

  const timeSeries = new TimeSeries({
    name: 'readings',
    columns: ['time', 's1', 's2', 's3', 's4'],
    points: dataArray
  })

  const lastFewSeconds = new TimeRange(latestNow - 5000, latestNow)

  return (
    <div ref={ref}>
      {(timeSeries == null)
        ? 'Loading ...'
        : (
          <ChartContainer width={checkedWidth} timeRange={lastFewSeconds} title={position + ': ' + props.name}>
            <ChartRow height={checkedWidth / 3} showGrid>
              <YAxis id='axis1' min={average - GRAPH_AREA_PX} max={average + GRAPH_AREA_PX} width={28} type='linear' format='.0f' />
              <Charts>
                <LineChart axis='axis1' series={timeSeries} columns={['s1', 's2', 's3', 's4']} style={style} />
              </Charts>
            </ChartRow>
          </ChartContainer>
          )}
    </div>
  )
}

export { SensorData }
