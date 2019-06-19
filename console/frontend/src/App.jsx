import React from 'react'
import './App.css'
import { SensorMonitor } from './SensorMonitor'
import { MqttIndicator } from './MqttIndicator'
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import AsyncClient from 'async-mqtt'

const mqttClient = AsyncClient.connect('ws://' + window.location.hostname + ':8181')

function App () {
  return (
    <div className='App'>
      <Container fluid='true'>
        <Row>
          <Col md={0} lg={1} />
          <Col md={12} lg={10}>
            <Navbar expand='lg' variant='dark' bg='dark ' style={{ marginBottom: '40px' }}>
              <Navbar.Brand href='#'>As One</Navbar.Brand>
              <Nav className='ml-auto' style={{ maxHeight: '32px' }}>
                <MqttIndicator mqtt={mqttClient} />
              </Nav>
            </Navbar>
          </Col>
          <Col md={0} lg={1} />
        </Row>
        <Row>
          <Col md={0} lg={1} />
          <Col>
            <SensorMonitor />
          </Col>
          <Col md={0} lg={1} />
        </Row>
      </Container>
    </div>
  )
}

export default App
