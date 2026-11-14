import React from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import axios from 'axios'
import logger from './logger'

const SENSOR_FLIP_PATH = '/game/flipSensors'

function SensorFlipper () {
  async function postToFlip () {
    try {
      const response = await axios.post(SENSOR_FLIP_PATH)
      logger.log('flipped sensor: ' + response)
    } catch (error) {
      logger.error(error)
    }
  }

  return (
    <Row>
      <Col md={5} sm={0} />
      <Col sm={2}>
        <Button
          className='btn-block'
          style={{ whiteSpace: 'nowrap' }}
          onClick={() => {
            postToFlip()
          }}
        >↖️ FLIP ↗️
        </Button>
      </Col>
      <Col md={5} sm={0} />
    </Row>
  )
}

export { SensorFlipper }
