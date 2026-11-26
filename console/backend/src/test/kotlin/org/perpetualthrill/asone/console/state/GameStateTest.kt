package org.perpetualthrill.asone.console.state

import io.kotest.matchers.maps.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.reactivex.subjects.PublishSubject
import org.junit.jupiter.api.Test
import org.perpetualthrill.asone.console.io.MqttManager
import org.perpetualthrill.asone.console.model.Sensor
import org.perpetualthrill.asone.console.state.GameState.SensorPosition.LEFT
import org.perpetualthrill.asone.console.state.GameState.SensorPosition.RIGHT

@OptIn(ExperimentalUnsignedTypes::class)
class GameStateTest {

    private val readings = PublishSubject.create<Sensor.Reading>()
    private var activeSensors = listOf<String>()

    private val sensorState = mockk<SensorState> {
        every { readingStream } returns readings
        every { activeSensorNames } answers { activeSensors }
    }

    private val gameState = GameState(sensorState, mockk<MqttManager>(relaxed = true))

    private fun readingFrom(name: String) = readings.onNext(Sensor.Reading(name, 500, 500, 500, 500, timestamp = 0))

    @Test
    fun `assigns the first two sensors to left then right`() {
        activeSensors = listOf("a", "b")
        readingFrom("a")
        readingFrom("b")

        gameState.gameSensors shouldBe mapOf("a" to LEFT, "b" to RIGHT)
    }

    @Test
    fun `drops a removed sensor without waiting for another sensor to report`() {
        activeSensors = listOf("a")
        readingFrom("a")
        gameState.gameSensors shouldBe mapOf("a" to LEFT)

        activeSensors = listOf()

        gameState.gameSensors.shouldBeEmpty()
    }

    @Test
    fun `a new sensor takes over the position of a removed one`() {
        // removing "a" while iterating used to throw ConcurrentModificationException
        activeSensors = listOf("a", "b")
        readingFrom("a")
        readingFrom("b")

        activeSensors = listOf("b", "c")
        readingFrom("c")

        gameState.gameSensors shouldBe mapOf("b" to RIGHT, "c" to LEFT)
    }

    @Test
    fun `flipping sensors swaps their positions`() {
        activeSensors = listOf("a", "b")
        readingFrom("a")
        readingFrom("b")

        gameState.gameSensors shouldBe mapOf("a" to LEFT, "b" to RIGHT)

        gameState.flipSensors()

        gameState.gameSensors shouldBe mapOf("b" to LEFT, "a" to RIGHT)
    }

    @Test
    fun `flipping ignores sensors that have gone away`() {
        activeSensors = listOf("a", "b")
        readingFrom("a")
        readingFrom("b")

        activeSensors = listOf("b")
        gameState.flipSensors()

        gameState.gameSensors shouldBe mapOf("b" to LEFT)
    }
}
