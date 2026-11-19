import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import logger from './logger'

// via https://stackoverflow.com/questions/56197689/hook-doesnt-rerender-component
// and https://medium.com/@cwlsn/how-to-fetch-data-with-react-hooks-in-a-minute-e0f9a15a44d6
function useFetch (url) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUrl () {
      try {
        const response = await axios.get(url)
        setData(response.data)
        setLoading(false)
      } catch (error) {
        logger.error(error)
      }
    }

    fetchUrl().then()
  }, [url])
  return [data, loading]
}

// use ResizeObserver rather than window resize events, so the rect also
// updates when the element itself changes size without the window changing,
// e.g. when a collapsed (display: none) parent is opened
function useClientRect () {
  const [rect, setRect] = useState(null)
  const observerRef = useRef(null)

  const ref = useCallback(node => {
    // clean up connection when fed a null node
    if (node === null) {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      return
    }

    function update () {
      const newRect = node.getBoundingClientRect()
      // a hidden element measures 0x0. keep the last good rect rather than
      // shrinking whatever is rendered inside to nothing if necessary
      if (newRect.width > 0) {
        setRect(newRect)
      }
    }

    const observer = new window.ResizeObserver(update)
    observer.observe(node)
    observerRef.current = observer
  }, [])

  return [rect, ref]
}

const DEFAULT_TINY_WIDTH_PX = 200
function useCheckedWidth () {
  const [checkedWidth, setCheckedWidth] = useState(DEFAULT_TINY_WIDTH_PX)
  const [rect, ref] = useClientRect()

  useEffect(() => {
    // tiny default so that we don't ever end up with a null screen
    let newCheckedWidth = DEFAULT_TINY_WIDTH_PX
    if (rect) {
      newCheckedWidth = rect.width
    }
    setCheckedWidth(newCheckedWidth)
  }, [rect])

  return [ref, checkedWidth, setCheckedWidth]
}

export { useFetch, useClientRect, useCheckedWidth }
