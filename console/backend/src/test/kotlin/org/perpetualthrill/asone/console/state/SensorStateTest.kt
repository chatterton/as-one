package org.perpetualthrill.asone.console.state

import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import io.reactivex.subjects.PublishSubject
import org.junit.jupiter.api.Test
import org.perpetualthrill.asone.console.io.SerialMonitor
import org.perpetualthrill.asone.console.model.Sensor

@OptIn(ExperimentalUnsignedTypes::class)
class SensorStateTest {

    private val serialReadings = PublishSubject.create<Sensor.Reading>()

    private val serialMonitor = mockk<SerialMonitor> {
        every { sensorStream } returns serialReadings
        every { sensors } returns listOf(mockk { every { name } returns "dev_ttyUSB0" })
    }

    private val sensorState = SensorState(serialMonitor)

    @Test
    fun `reports sensors attached to the serial monitor`() {
        sensorState.activeSensorNames shouldContainExactly listOf("dev_ttyUSB0")
    }

    @Test
    fun `buffers readings arriving from the serial monitor`() {
        sensorState.start()
        val reading = Sensor.Reading("dev_ttyUSB0", 1, 2, 3, 4, timestamp = 0)

        serialReadings.onNext(reading)

        sensorState.latestReadings.size shouldBe 1
        sensorState.latestReadings.first() shouldBe reading
        verify(exactly = 1) { serialMonitor.sensorStream }
    }
}
