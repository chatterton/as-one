package org.perpetualthrill.asone.console.model

import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread

class SensorTest {

    private val sensor = Sensor("test")

    @AfterEach
    fun tearDown() = sensor.finish()

    @Test
    fun `readings survive concurrent writes, prunes and snapshots`() {
        // a writer thread appends while this thread prunes with removeIf (like the
        // prune task) and copies with toArray (like GameState). pruning down to a
        // tiny deque keeps the writer busy instead of waiting on the cap, which is
        // what makes the race show up
        val running = AtomicBoolean(true)
        val started = CountDownLatch(1)
        val writerError = AtomicReference<Throwable>()
        val writer = thread {
            try {
                started.countDown()
                var ts = 0L
                while (running.get()) {
                    // safety net only; the pruner normally keeps this far below the cap
                    if (sensor.readings.size > 4096) Thread.onSpinWait()
                    else sensor.readings.addFirst(Sensor.Reading("test", 500, 500, 500, 500, timestamp = ts++))
                }
            } catch (t: Throwable) {
                writerError.set(t)
            }
        }

        try {
            started.await()
            val deadline = System.currentTimeMillis() + 200
            while (System.currentTimeMillis() < deadline && writerError.get() == null) {
                val newest = sensor.readings.peekFirst()?.timestamp ?: 0
                sensor.readings.removeIf { it.timestamp < newest - 16 }
                sensor.readings.toArray().asList() shouldNotContain null
            }
        } finally {
            running.set(false)
            writer.join()
        }

        writerError.get() shouldBe null
    }
}
