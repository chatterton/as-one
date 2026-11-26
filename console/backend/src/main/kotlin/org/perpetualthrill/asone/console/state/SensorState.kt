package org.perpetualthrill.asone.console.state

import com.kizitonwose.time.seconds
import io.reactivex.Observable
import io.reactivex.subjects.PublishSubject
import io.reactivex.subjects.Subject
import org.perpetualthrill.asone.console.di.Injector
import org.perpetualthrill.asone.console.io.SerialMonitor
import org.perpetualthrill.asone.console.model.SENSOR_UPDATE_INTERVAL
import org.perpetualthrill.asone.console.model.Sensor
import org.perpetualthrill.asone.console.model.SensorSimulator
import org.perpetualthrill.asone.console.util.subscribeWithErrorLogging
import java.util.concurrent.ConcurrentLinkedDeque
import javax.inject.Inject
import javax.inject.Singleton

private val SENSOR_READING_BUFFER_TIME = 5.seconds
// longValue is in each interval's own unit, so convert both to ms and divide
private val SENSOR_READING_SAMPLE_SIZE =
    (SENSOR_READING_BUFFER_TIME.inMilliseconds.longValue / SENSOR_UPDATE_INTERVAL.inMilliseconds.longValue).toInt()

@ExperimentalUnsignedTypes
@Singleton
class SensorState
@Inject
constructor(
    private val serialMonitor: SerialMonitor
) {
    // each sensor runs from its own thread. Serialize the stream so subscribers never run concurrently
    private val internalReadingStream: Subject<Sensor.Reading> = PublishSubject.create<Sensor.Reading>().toSerialized()
    val readingStream: Observable<Sensor.Reading> = internalReadingStream

    // read by the web server thread while the subscriber below mutates it
    private val readingBuffer = ConcurrentLinkedDeque<Sensor.Reading>()

    private val simulators = mutableMapOf<String, SensorSimulator>()

    fun start() {
        serialMonitor.sensorStream.subscribeWith(internalReadingStream)

        // maintain queue of last n readings for web service
        readingStream.subscribeWithErrorLogging(this) { reading ->
            readingBuffer.addFirst(reading)
            while (readingBuffer.size > SENSOR_READING_SAMPLE_SIZE) {
                readingBuffer.pollLast()
            }
        }
    }

    val latestReadings: Array<out Any>
        get() = readingBuffer.toArray()

    val activeSensorNames: List<String>
        get() = (simulators.keys + serialMonitor.sensors.map { it.name }).toList()

    private inline fun <reified T> fixArray(list: List<*>): Array<T> {
        return (list as List<T>).toTypedArray()
    }

    fun readingsForSensor(name: String): Array<Sensor.Reading> {

        simulators[name]?.let {
            return fixArray(it.sensor.readings.toArray().asList())
        }
        serialMonitor.sensors.firstOrNull { it.name == name }?.let {
            return fixArray(it.readings.toArray().asList())
        }
        throw Exception("Sensor not found: name")
    }

    fun addSimulator(): String {
        val simulator = Injector.get().sensorSimulator()
        val name = "simulator${simulator.hashCode()}"
        simulator.start(name)
        simulators[name] = simulator
        simulator.subscribeObserver(internalReadingStream)
        return name
    }

    fun addSimpleSimulator(magicNumber: Int): String {
        val simulator = Injector.get().sensorSimulator()
        val name = "simpleSimulator-$magicNumber-${simulator.hashCode()}"
        simulator.startSimple(name, magicNumber)
        simulators[name] = simulator
        simulator.subscribeObserver(internalReadingStream)
        return name
    }

    fun removeSimulator(name: String): Boolean {
        val simulator = simulators[name]
        if (null != simulator) {
            simulators.remove(name)
            simulator.finish()
            return true
        }
        return false
    }

    fun updateSimulatorState(simulatorName: String, newStateString: String): Boolean {
        val simulator = simulators[simulatorName]
        if (null != simulator) {
            val newState = SensorSimulator.SimulatorState.forString(newStateString)
            simulator.updateState(newState)
            return true
        }
        return false
    }

}