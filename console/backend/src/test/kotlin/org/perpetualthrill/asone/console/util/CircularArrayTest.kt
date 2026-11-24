package org.perpetualthrill.asone.console.util

import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test

class CircularArrayTest {

    @Test
    fun `keeps insertion order before filling up`() {
        val array = CircularArray<Int>(3)
        array.add(1)
        array.add(2)

        array.size shouldBe 2
        array.toList() shouldContainExactly listOf(1, 2)
    }

    @Test
    fun `overwrites the oldest element once full`() {
        val array = CircularArray<Int>(3)
        (1..5).forEach { array.add(it) }

        array.size shouldBe 3
        array[0] shouldBe 3
        array.toList() shouldContainExactly listOf(3, 4, 5)
    }
}
