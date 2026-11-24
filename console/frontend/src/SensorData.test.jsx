/* eslint-env mocha */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { SensorData } from './SensorData'
import logger from './logger'

// vi.mock calls are hoisted above the imports, so the component under test
// sees these instead of the real modules
const shared = vi.hoisted(() => ({
  messageHandler: null, // the component's mqtt 'message' callback
  lastSeries: null // the TimeSeries most recently handed to LineChart
}))

vi.mock('mqtt', () => ({
  default: {
    connect: () => ({
      subscribeAsync: () => Promise.resolve(),
      on: (event, handler) => {
        if (event === 'message') shared.messageHandler = handler
      },
      end: () => {}
    })
  }
}))

// Stub chart components: we only care about the data the component builds,
// not SVG rendering. The real pondjs TimeSeries is still used, so its
// "non-chronological events" check runs for real.
vi.mock('react-timeseries-charts', () => {
  const Pass = ({ children }) => children || null
  return {
    ChartContainer: Pass,
    ChartRow: Pass,
    Charts: Pass,
    YAxis: () => null,
    LineChart: ({ series }) => {
      shared.lastSeries = series
      return null
    }
  }
})

const TICK_MS = 100 // matches the component's useInterval period

// Build a message in the backend's CSV format:
// name,s1,s2,s3,s4,epochMillis,position
function reading (name, time, values = [500, 500, 500, 500], position = 'LEFT') {
  return [name, ...values, time, position].join(',')
}

function send (message) {
  act(() => { shared.messageHandler('asOne/sensor/reading', message) })
}

function tick (times = 1) {
  act(() => { vi.advanceTimersByTime(TICK_MS * times) })
}

function seriesTimes () {
  const series = shared.lastSeries
  const times = []
  for (let i = 0; i < series.size(); i++) {
    times.push(series.at(i).timestamp().getTime())
  }
  return times
}

describe('SensorData', () => {
  let container

  beforeEach(() => {
    // jsdom has no ResizeObserver; useCheckedWidth only needs a no-op one
    vi.stubGlobal('ResizeObserver', class {
      observe () {}
      disconnect () {}
    })
    vi.useFakeTimers()
    shared.messageHandler = null
    shared.lastSeries = null
    container = document.createElement('div')
    // StrictMode makes React call render-phase code (including setState
    // updater functions) more than once under test, flushing out any
    // side effects in render/updaters
    act(() => {
      ReactDOM.render(
        <React.StrictMode>
          <SensorData name='s1' address='ws://test' />
        </React.StrictMode>,
        container
      )
    })
  })

  afterEach(() => {
    act(() => { ReactDOM.unmountComponentAtNode(container) })
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // Baseline regression test: interleave messages and ticks and check
  // nothing is lost, duplicated or reordered between the mqtt buffer and
  // the graph.
  it('graphs every reading exactly once, in order, across many ticks', () => {
    let t = 1000
    const expected = []
    for (let batch = 0; batch < 20; batch++) {
      for (let i = 0; i < 3; i++) {
        send(reading('s1', t))
        expected.push(t)
        t += 10
      }
      tick()
    }

    expect(seriesTimes()).toEqual(expected)
  })

  it('drops a reading whose timestamp goes backwards instead of crashing', () => {
    const log = vi.spyOn(logger, 'log').mockImplementation(() => {})

    send(reading('s1', 1000))
    send(reading('s1', 2000))
    tick()
    send(reading('s1', 1500)) // clock stepped back
    send(reading('s1', 2500))
    tick()

    expect(seriesTimes()).toEqual([1000, 2000, 2500])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('non-chronological'))
  })

  it('ignores readings from other sensors, including ones sharing a name prefix', () => {
    send(reading('s1', 1000))
    send(reading('s10', 1005)) // would match a startsWith('s1') check
    send(reading('s2', 1010))
    send(reading('s1', 1020))
    tick()

    expect(seriesTimes()).toEqual([1000, 1020])
  })

  it('skips readings with a malformed timestamp', () => {
    send(reading('s1', 1000))
    send(reading('s1', 'garbage'))
    send(reading('s1', 1020))
    tick()

    expect(seriesTimes()).toEqual([1000, 1020])
  })
})
