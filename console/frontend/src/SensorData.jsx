import React, { useState, useEffect, useRef } from 'react'
import { useCheckedWidth } from './hooks'
import useInterval from '@restart/hooks/useInterval'
import logger from './logger'
import { Charts, ChartContainer, ChartRow, YAxis, LineChart } from 'react-timeseries-charts'
import { TimeSeries, TimeRange } from 'pondjs'
import PropTypes from 'prop-types'
import AsyncClient from 'async-mqtt'
import Ring from "ringjs"

SensorData.propTypes = {
  name: PropTypes.string.isRequired,
  address: PropTypes.string.isRequired
}

function SensorData (props) {
  const address = props.address
  const name = props.name

  let [latestNow, setLatestNow] = useState((new Date()).valueOf())
  let [data, setData] = useState(new Ring(300))
  let [ref, checkedWidth] = useCheckedWidth()
  let [started, setStarted] = useState(false)
  let [position, setPosition] = useState("")

  let bufferRef = useRef([])
  let currentBuf = bufferRef.current

  // Move new messages from buffer into data state and clear buffer
  // Clearing is slightly unsafe, but in this application losing a reading
  // or two is not a big deal
  useInterval(() => {
    setData(dataref => {
      currentBuf.map( reading => dataref.push(reading) )
      return dataref
    })
    setLatestNow((new Date()).valueOf())
    currentBuf.length = 0 // javascript you so crazy
  }, 100)

  // Initializer. Should only run at mount, but contains a message handler
  // that pushes all of the state updates into the buffer
  useEffect(() => {
    async function subscribe () {
      const mqtt = AsyncClient.connect(address)
      try {
        await mqtt.subscribe('asOne/sensor/reading')
        logger.log('subscribed sensormonitor')
      } catch (e) {
        logger.error('error connecting to mqtt')
        logger.error(e)
      }

      mqtt.on('message', (_, message) => {
        if (message == null) return
        const msgString = message.toString()
        if (!msgString.startsWith(name)) return
        const reading = msgString.split(',')
        const point = [parseInt(reading[5]), reading[1], reading[2], reading[3], reading[4]]
        currentBuf.push(point)
        setPosition(reading[6])
      })

      return () => {
        if (mqtt.close) mqtt.close()
      }
    }

    if (!started) {
      subscribe()
      setStarted(true)
    }
  }, [started, address, currentBuf, name, setPosition])

  const style = {
    s1: {
      stroke: '#a02c2c',
      opacity: 0.5
    },
    s2: {
      stroke: '#b03c3c',
      opacity: 0.5
    },
    s3: {
      stroke: '#c04c4c',
      opacity: 0.5
    },
    s4: {
      stroke: '#d05c5c',
      opacity: 0.5
    }
  }

  const timeSeries = new TimeSeries({
      name: 'readings',
      columns: ['time', 's1', 's2', 's3', 's4'],
      points: data.toArray()
  })

  const lastFewSeconds = new TimeRange(latestNow - 5000, latestNow)

  return (
    <div ref={ref}>
      { (timeSeries == null) ? 'Loading ...' : (
        <ChartContainer width={checkedWidth} timeRange={lastFewSeconds} title={position+": "+props.name}>
          <ChartRow height={checkedWidth / 3} showGrid>
            <YAxis id='axis1' min={400} max={600} width={28} type='linear' format='.0f' />
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
