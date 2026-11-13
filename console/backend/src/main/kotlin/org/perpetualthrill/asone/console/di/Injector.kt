package org.perpetualthrill.asone.console.di

import org.perpetualthrill.asone.console.Console

@ExperimentalUnsignedTypes
class Injector private constructor() {
    companion object {
        fun get() : MainComponent = Console.getInstance().mainComponent
    }
}
