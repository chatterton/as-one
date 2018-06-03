/*
   Sketch to handle each sample read from a PulseSensor.
   Typically used when you don't want to use interrupts
   to read PulseSensor voltages.

   Here is a link to the tutorial that discusses this code
   https://pulsesensor.com/pages/getting-advanced

   Copyright World Famous Electronics LLC - see LICENSE
   Contributors:
     Joel Murphy, https://pulsesensor.com
     Yury Gitman, https://pulsesensor.com
     Bradford Needham, @bneedhamia, https://bluepapertech.com

   Licensed under the MIT License, a copy of which
   should have been included with this software.

   This software is not intended for medical use.
*/

/*
   Every Sketch that uses the PulseSensor Playground must
   define USE_ARDUINO_INTERRUPTS before including PulseSensorPlayground.h.
   Here, #define USE_ARDUINO_INTERRUPTS false tells the library to
   not use interrupts to read data from the PulseSensor.

   If you want to use interrupts, simply change the line below
   to read:
     #define USE_ARDUINO_INTERRUPTS true

   Set US_PS_INTERRUPTS to false if either
   1) Your Arduino platform's interrupts aren't yet supported
   by PulseSensor Playground, or
   2) You don't wish to use interrupts because of the side effects.

   NOTE: if US_PS_INTERRUPTS is false, your Sketch must
   call pulse.sawNewSample() at least once every 2 milliseconds
   to accurately read the PulseSensor signal.
*/
#define USE_ARDUINO_INTERRUPTS false
#include <PulseSensorPlayground.h>

/*
   The format of our output.

   Set this to PROCESSING_VISUALIZER if you're going to run
    the Processing Visualizer Sketch.
    See https://github.com/WorldFamousElectronics/PulseSensor_Amped_Processing_Visualizer

   Set this to SERIAL_PLOTTER if you're going to run
    the Arduino IDE's Serial Plotter.
*/
//const int OUTPUT_TYPE = PROCESSING_VISUALIZER;
const int OUTPUT_TYPE = SERIAL_PLOTTER;

/*
   Number of PulseSensor devices we're reading from.
*/
const int PULSE_SENSOR_COUNT = 3;


/*
   Pinout:
     PIN_INPUT = Analog Input. Connected to the pulse sensor
      purple (signal) wire.
     PIN_BLINK = digital Output. Connected to an LED (and 220 ohm resistor)
      that will flash on each detected pulse.
     PIN_FADE = digital Output. PWM pin onnected to an LED (and resistor)
      that will smoothly fade with each pulse.
      NOTE: PIN_FADE must be a pin that supports PWM.
       If USE_INTERRUPTS is true, Do not use pin 9 or 10 for PIN_FADE,
       because those pins' PWM interferes with the sample timer.
*/
const int PIN_INPUT_1 = A0;
const int PIN_INPUT_2 = A3;
const int PIN_INPUT_3 = A6;
const int PIN_BLINK = LED_BUILTIN;    // Pin 13 is the on-board LED
//const int PIN_FADE = 5;
const int THRESHOLD = 550;   // Adjust this number to avoid noise when idle

/*
   samplesUntilReport = the number of samples remaining to read
   until we want to report a sample over the serial connection.

   We want to report a sample value over the serial port
   only once every 20 milliseconds (10 samples) to avoid
   doing Serial output faster than the Arduino can send.
*/
byte samplesUntilReport;
const byte SAMPLES_PER_SERIAL_SAMPLE = 10;

/*
   All the PulseSensor Playground functions.
*/
PulseSensorPlayground pulseSensor(PULSE_SENSOR_COUNT);

void setup() {
  /*
     Use 115200 baud because that's what the Processing Sketch expects to read,
     and because that speed provides about 11 bytes per millisecond.

     If we used a slower baud rate, we'd likely write bytes faster than
     they can be transmitted, which would mess up the timing
     of readSensor() calls, which would make the pulse measurement
     not work properly.
  */
  Serial.begin(115200);

  // Configure the ESP32 ADC. This is from esp32-hal-adc.h
  analogSetWidth(10); // range 0 - 1023, as expected by pulsesensor
  analogSetAttenuation(ADC_11db); // highest attenuation, used for 3.3v input

  /* some day we may want to do something like this to get fades working

#ifdef ESP32
  ledcAttachPin(LED1_RED, LED1_RED_CHANNEL); // Assign LED pin to channel 0
  ledcSetup(LED1_RED_CHANNEL, 12000, 8); // 12 kHz PWM, 8-bit resolution
#else
  pinMode(LED1_RED, OUTPUT);
#endif
   
   */

   // Set up LED now that blinkOnPulse is not doing it
   pinMode(PIN_BLINK, OUTPUT);

  // Configure the PulseSensor manager.
  pulseSensor.analogInput(PIN_INPUT_1, 0);
  pulseSensor.analogInput(PIN_INPUT_2, 1);
  pulseSensor.analogInput(PIN_INPUT_3, 2);

  //pulseSensor.blinkOnPulse(PIN_BLINK);
 // pulseSensor.fadeOnPulse(PIN_FADE);

  pulseSensor.setSerial(Serial);
  pulseSensor.setOutputType(OUTPUT_TYPE);
  pulseSensor.setThreshold(THRESHOLD);

  // Skip the first SAMPLES_PER_SERIAL_SAMPLE in the loop().
  samplesUntilReport = SAMPLES_PER_SERIAL_SAMPLE;

  // Now that everything is ready, start reading the PulseSensor signal.
  if (!pulseSensor.begin()) {
    /*
       PulseSensor initialization failed,
       likely because our Arduino platform interrupts
       aren't supported yet.

       If your Sketch hangs here, try changing USE_PS_INTERRUPT to false.
    */
    for(;;) {
      // Flash the led to show things didn't work.
      digitalWrite(PIN_BLINK, LOW);
      delay(50);
      digitalWrite(PIN_BLINK, HIGH);
      delay(50);
    }
  }
}

void loop() {

  /*
     See if a sample is ready from the PulseSensor.

     If USE_INTERRUPTS is true, the PulseSensor Playground
     will automatically read and process samples from
     the PulseSensor.

     If USE_INTERRUPTS is false, this call to sawNewSample()
     will, if enough time has passed, read and process a
     sample (analog voltage) from the PulseSensor.
  */
  if (pulseSensor.sawNewSample()) {
    /*
       Every so often, send the latest Sample.
       We don't print every sample, because our baud rate
       won't support that much I/O.
    */
    if (--samplesUntilReport == (byte) 0) {
      samplesUntilReport = SAMPLES_PER_SERIAL_SAMPLE;

      //pulseSensor.outputSample();

      for (int i = 0; i < PULSE_SENSOR_COUNT; ++i) {
        if (i != 0) {
          Serial.print(F(","));
        }
        Serial.print(pulseSensor.getBeatsPerMinute(i));
        Serial.print(F(","));
        Serial.print(pulseSensor.getLatestSample(i));
      }
      Serial.println();


      /*
         At about the beginning of every heartbeat,
         report the heart rate and inter-beat-interval.
      */
      /*
      if (pulseSensor.sawStartOfBeat()) {
        pulseSensor.outputBeat();
      }
      */
    }

    /*******
      Here is a good place to add code that could take up
      to a millisecond or so to run.
    *******/

    // This kinda works, but is awfully twitchy. I blame the underlying
    // isInsideBeat implementation
    bool inPulse = false;
    for (int i = 0; i < PULSE_SENSOR_COUNT; i++) {
      inPulse = inPulse || pulseSensor.isInsideBeat(i);
    }
    digitalWrite(PIN_BLINK, inPulse);
  }

  /******
     Don't add code here, because it could slow the sampling
     from the PulseSensor.
  ******/
}

