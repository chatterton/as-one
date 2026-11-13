package org.perpetualthrill.asone.console.io

import io.ktor.server.application.call
import io.ktor.server.application.install
import io.ktor.serialization.gson.gson
import io.ktor.http.HttpStatusCode
import io.ktor.server.plugins.compression.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.http.content.defaultResource
import io.ktor.server.http.content.resources
import io.ktor.server.http.content.static
import io.ktor.server.locations.*
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import org.perpetualthrill.asone.console.state.GameState
import org.perpetualthrill.asone.console.state.SensorState
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.system.exitProcess

@KtorExperimentalLocationsAPI
@ExperimentalUnsignedTypes
@Singleton
class WebServer
@Inject
constructor(
    private val sensorState: SensorState,
    private val gameState: GameState
) {

    private val logger: Logger = LoggerFactory.getLogger(this.javaClass)

    @Location("/sensors/simulated/addSimple/{magicNumber}")
    data class AddSimpleLocation(
        val magicNumber: Int
    )

    @Location("/sensors/simulated/{name}")
    data class SimulatorLocation(
        val name: String
    )

    @Location("/sensors/{name}")
    data class SensorLocation(
        val name: String
    )

    fun start(hostName: String) {
        val server = embeddedServer(Netty, port = 12345, host = hostName) {
            install(Compression)
            install(ContentNegotiation) {
                gson {
                    setPrettyPrinting()
                    serializeNulls()
                }
            }
            install(Locations)

            routing {
                // Static frontend and related content
                static("/") {
                    resources("web-static")
                    defaultResource("web-static/index.html")
                }

                // Sensors including simulators
                route("/sensors") {
                    get {
                        call.respond(gameState.gameSensors)
                    }
                    get("latest") {
                        call.respond(sensorState.latestReadings)
                    }
                    route("simulated") {
                        post("add") {
                            val name = sensorState.addSimulator()
                            val href = locations.href(SimulatorLocation(name=name))
                            call.respondText(text = href, status = HttpStatusCode.Created)
                        }
                    }
                }
                get<SensorLocation> {
                    try {
                        call.respond(sensorState.readingsForSensor(it.name))
                    } catch (_: Exception) {
                        call.respondText("Not found: ${it.name}", status = HttpStatusCode.NotFound)
                    }
                }

                // Simulators
                get<SimulatorLocation> { simulator ->
                    call.respondText("SimulatorLocation at ${locations.href(simulator)}")
                }
                delete<SimulatorLocation> { simulator ->
                    if (sensorState.removeSimulator(simulator.name)) {
                        call.respondText("OK")
                    } else {
                        call.respondText("Not found: ${simulator.name}", status = HttpStatusCode.NotFound)
                    }
                }
                patch<SimulatorLocation> { simulator ->
                    val update = call.receive<SimulatorUpdate>()
                    if (sensorState.updateSimulatorState(simulator.name, update.newState)) {
                        call.respondText("OK")
                    } else {
                        call.respondText("Not found: ${simulator.name}", status = HttpStatusCode.NotFound)
                    }
                }
                post<AddSimpleLocation> { addSimple ->
                    val name = sensorState.addSimpleSimulator(addSimple.magicNumber)
                    val href = locations.href(SimulatorLocation(name = name))
                    call.respondText(text = href, status = HttpStatusCode.Created)
                }

                // Game and flame state
                route("/game") {
                    post("flipSensors") {
                        gameState.flipSensors()
                        call.respondText("OK")
                    }
                    post("fire") {
                        val fireBPM = gameState.fire()
                        call.respondText("fire at $fireBPM bpm")
                    }
                    post("reset") {
                        exitProcess(0)
                    }
                }

            }
        }
        server.start()
        logger.info("as one console web server started")
    }

}

data class SimulatorUpdate(
    val newState: String
)
