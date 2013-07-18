// sound emulation routines for EstyJs
// written by Darren Coles - taken from jsspeccy routines

// Sound routines for jsspeccy
// General sound routines and 48k buzzer emulation written by Darren Coles
// 128k Spectrum sound routines developed from DelphiSpec emulator (credits below).
// (c) 2013 Darren Coles
//
// Credits from DelphiSpec:
//
//  Routines for emulating the 128K Spectrum's AY-3-8912 sound generator
//
//  Author: James Bagg <chipmunk_uk_1@hotmail.com>
//
//   With minor optimisations and mods by
//           Chris Cowley <ccowley@grok.co.uk>
//
//   Translation to Delphi Object Pascal by
//           Jari Korhonen <jarit.korhonen@luukku.com>
//
//   Copyright (C)1999-2000 Grok Developments Ltd  and James Bagg
//   http://www.grok.co.uk/      http://www.chipmunks-corner.co.uk
//   This program is free software; you can redistribute it and/or
//   modify it under the terms of the GNU General Public License
//   as published by the Free Software Foundation; either version 2
//   of the License, or (at your option) any later version.
//   This program is distributed in the hope that it will be useful,
//   but WITHOUT ANY WARRANTY; without even the implied warranty of
//   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//   GNU General Public License for more details.
//
//   You should have received a copy of the GNU General Public License
//   along with this program; if not, write to the Free Software
//   Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
//
// *******************************************************************************/

EstyJs.Sound = function (opts) {
    var self = {};

    var clock = 2000000;

    var samplesPerFrame = 882;
    var sampleRate = samplesPerFrame * 50;

    var audioOutput = null;
    var audioBuffer = null;

    var soundEnabled = true;

    var regSelect = 0;

    var soundDataFrameBytes = 0;

    var frameCount = 0;
    var rowCount = 0;

    var processor = null;

    var WCount = 0;
    var lCounter = 0;


    //ay stuff
    var MAX_OUTPUT = 63;
    var AY_STEP = 32768;
    var MAXVOL = 31;

    // AY register ID's
    var AY_AFINE = 0;
    var AY_ACOARSE = 1;
    var AY_BFINE = 2;
    var AY_BCOARSE = 3;
    var AY_CFINE = 4;
    var AY_CCOARSE = 5;
    var AY_NOISEPER = 6;
    var AY_ENABLE = 7;
    var AY_AVOL = 8;
    var AY_BVOL = 9;
    var AY_CVOL = 10;
    var AY_EFINE = 11;
    var AY_ECOARSE = 12;
    var AY_ESHAPE = 13;
    var AY_PORTA = 14;
    var AY_PORTB = 15;

    //var RegArray = new Int32Array(16);
    //var VolTableArray 

    var AY8912_sampleRate = 0;
    var AY8912_register_latch = 0;
    var AY8912_Regs = new Int32Array(16);
    var AY8912_UpdateStep = 0; //Double;
    var AY8912_PeriodA = 0;
    var AY8912_PeriodB = 0;
    var AY8912_PeriodC = 0;
    var AY8912_PeriodN = 0;
    var AY8912_PeriodE = 0;
    var AY8912_CountA = 0;
    var AY8912_CountB = 0;
    var AY8912_CountC = 0;
    var AY8912_CountN = 0;
    var AY8912_CountE = 0;
    var AY8912_VolA = 0;
    var AY8912_VolB = 0;
    var AY8912_VolC = 0;
    var AY8912_VolE = 0;
    var AY8912_EnvelopeA = 0;
    var AY8912_EnvelopeB = 0;
    var AY8912_EnvelopeC = 0;
    var AY8912_OutputA = 0;
    var AY8912_OutputB = 0;
    var AY8912_OutputC = 0;
    var AY8912_OutputN = 0;
    var AY8912_CountEnv = 0;
    var AY8912_Hold = 0;
    var AY8912_Alternate = 0;
    var AY8912_Attack = 0;
    var AY8912_Holding = 0;
    var AY8912_VolTable2 = new Int32Array(64);

    var AY_OutNoise = 0;

    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
        /* Use Web Audio API */
        audioBuffer = new Array();

        var audioContext = new AudioContext();
        var audioNode = audioContext.createJavaScriptNode(2048, 1, 1);

        onAudioProcess = function (e) {
            var buffer = e.outputBuffer.getChannelData(0);
            fillBuffer(buffer);
        };

        audioNode.onaudioprocess = onAudioProcess;
        audioNode.connect(audioContext.destination);
    }
    else if (typeof (Audio) != 'undefined') {
        /* Use audio data api */
        audioOutput = new Audio();
        if (typeof (audioOutput.mozSetup) != 'undefined') {
            audioBuffer = new Array();
            audioOutput.mozSetup(1, samplesPerFrame * 50);
        } else {
            audioOutput = null;
        }
    }

    function AY8912_reset() {
        AY8912_register_latch = 0;
        AY8912_OutputA = 0;
        AY8912_OutputB = 0;
        AY8912_OutputC = 0;
        AY8912_OutputN = 0xFF;
        AY8912_PeriodA = 0;
        AY8912_PeriodB = 0;
        AY8912_PeriodC = 0;
        AY8912_PeriodN = 0;
        AY8912_PeriodE = 0;
        AY8912_CountA = 0;
        AY8912_CountB = 0;
        AY8912_CountC = 0;
        AY8912_CountN = 0;
        AY8912_CountE = 0;
        AY8912_VolA = 0;
        AY8912_VolB = 0;
        AY8912_VolC = 0;
        AY8912_VolE = 0;
        AY8912_EnvelopeA = 0;
        AY8912_EnvelopeB = 0;
        AY8912_EnvelopeC = 0;
        AY8912_CountEnv = 0;
        AY8912_Hold = 0;
        AY8912_Alternate = 0;
        AY8912_Holding = 0;
        AY8912_Attack = 0;

        for (var i = 0; i <= AY_PORTA; i++) {
            AYWriteReg(i, 0);     //* AYWriteReg() uses the timer system; we cannot
        }                    //* call it at this time because the timer system
        //* has not been initialized.
    }

    function AY8912_set_clock(clock) {
        // the AY_STEP clock for the tone and noise generators is the chip clock    
        //divided by 8; for the envelope generator of the AY-3-8912, it is half 
        // that much (clock/16), but the envelope of the YM2149 goes twice as    
        // fast, therefore again clock/8.                                        
        // Here we calculate the number of AY_STEPs which happen during one sample  
        // at the given sample rate. No. of events = sample rate / (clock/8).    */
        // AY_STEP is a multiplier used to turn the fraction into a fixed point     */
        // number.}
        var t1 = AY_STEP * AY8912_sampleRate * 8.0;
        AY8912_UpdateStep = t1 / clock;
    }

    //
    // ** set output gain
    // **
    // ** The gain is expressed in 0.2dB increments, e.g. a gain of 10 is an increase
    // ** of 2dB. Note that the gain only affects sounds not playing at full volume,
    // ** since the ones at full volume are already played at the maximum intensity
    // ** allowed by the sound card.
    // ** 0x00 is the default.
    // ** 0xff is the maximum allowed value.
    // 

    function AY8912_set_volume(volume, gain) {
        var i, out1, out2;

        gain = gain & 0xFF;

        // increase max output basing on gain (0.2 dB per AY_STEP) */
        out1 = MAX_OUTPUT;
        out2 = MAX_OUTPUT;

        while (gain > 0) {
            gain--;
            out1 = out1 * 1.023292992;  ///* = (10 ^ (0.2/20)) */
            out2 = out2 * 1.023292992;
        }

        //  calculate the volume.voltage conversion table 
        //  The AY-3-8912 has 16 levels, in a logarithmic scale (3dB per AY_STEP) 
        //  The YM2149 still has 16 levels for the tone generators, but 32 for 
        //  the envelope generator (1.5dB per AY_STEP).
        for (var i = 31; i >= 0; i--) {
            //* limit volume to avoid clipping */
            if (out2 > MAX_OUTPUT)
                AY8912_VolTable2[i] = MAX_OUTPUT
            else
                AY8912_VolTable2[i] = Math.round(out2);

            out1 = out1 / 1.188502227; // .188502227 '/* = 10 ^ (1.5/20) = 1.5dB */
            out2 = out2 / 1.188502227  // .188502227
        }
        AY8912_VolTable2[63] = MAX_OUTPUT;
    }

    function AYWriteReg(r, v) {
        var old;

        AY8912_Regs[r] = v;

        //'/* A note about the period of tones, noise and envelope: for speed reasons,*/
        //'/* we count down from the period to 0, but careful studies of the chip     */
        //'/* output prove that it instead counts up from 0 until the counter becomes */
        //'/* greater or equal to the period. This is an important difference when the*/
        //'/* program is rapidly changing the period to modulate the sound.           */
        //'/* To compensate for the difference, when the period is changed we adjust  */
        //'/* our internal counter.                                                   */
        //'/* Also, note that period = 0 is the same as period = 1. This is mentioned */
        //'/* in the YM2203 data sheets. However, this does NOT apply to the Envelope */
        //'/* period. In that case, period = 0 is half as period = 1. 
        switch (r) {
            case AY_AFINE:
            case AY_ACOARSE:

                AY8912_Regs[AY_ACOARSE] = AY8912_Regs[AY_ACOARSE] & 0xF;

                old = AY8912_PeriodA;

                AY8912_PeriodA = Math.round((AY8912_Regs[AY_AFINE] + (256 * AY8912_Regs[AY_ACOARSE]))
			   * AY8912_UpdateStep);

                if (AY8912_PeriodA == 0)
                    AY8912_PeriodA = Math.round(AY8912_UpdateStep);

                AY8912_CountA = AY8912_CountA + (AY8912_PeriodA - old);

                if (AY8912_CountA <= 0)
                    AY8912_CountA = 1;
                break;
            case AY_BFINE:
            case AY_BCOARSE:

                AY8912_Regs[AY_BCOARSE] = AY8912_Regs[AY_BCOARSE] & 0xF;

                old = AY8912_PeriodB;

                AY8912_PeriodB = Math.round((AY8912_Regs[AY_BFINE] + (256 * AY8912_Regs[AY_BCOARSE]))
			  * AY8912_UpdateStep);

                if (AY8912_PeriodB == 0)
                    AY8912_PeriodB = Math.round(AY8912_UpdateStep);

                AY8912_CountB = AY8912_CountB + AY8912_PeriodB - old;

                if (AY8912_CountB <= 0)
                    AY8912_CountB = 1;
                break;

            case AY_CFINE:
            case AY_CCOARSE:

                AY8912_Regs[AY_CCOARSE] = AY8912_Regs[AY_CCOARSE] & 0xF;

                old = AY8912_PeriodC;

                AY8912_PeriodC = Math.round((AY8912_Regs[AY_CFINE] + (256 * AY8912_Regs[AY_CCOARSE]))
			  * AY8912_UpdateStep);

                if (AY8912_PeriodC == 0)
                    AY8912_PeriodC = Math.round(AY8912_UpdateStep);

                AY8912_CountC = AY8912_CountC + (AY8912_PeriodC - old);

                if (AY8912_CountC <= 0)
                    AY8912_CountC = 1;
                break;

            case AY_NOISEPER:

                AY8912_Regs[AY_NOISEPER] = AY8912_Regs[AY_NOISEPER] & 0x1F;

                old = AY8912_PeriodN;

                AY8912_PeriodN = Math.round(AY8912_Regs[AY_NOISEPER] * AY8912_UpdateStep);

                if (AY8912_PeriodN == 0)
                    AY8912_PeriodN = Math.round(AY8912_UpdateStep);

                AY8912_CountN = AY8912_CountN + (AY8912_PeriodN - old);

                if (AY8912_CountN <= 0)
                    AY8912_CountN = 1;
                break;

            case AY_AVOL:

                AY8912_Regs[AY_AVOL] = AY8912_Regs[AY_AVOL] & 0x1F;

                AY8912_EnvelopeA = AY8912_Regs[AY_AVOL] & 0x10;

                if (AY8912_EnvelopeA != 0)
                    AY8912_VolA = AY8912_VolE
                else {
                    if (AY8912_Regs[AY_AVOL] != 0)
                        AY8912_VolA = AY8912_VolTable2[AY8912_Regs[AY_AVOL] * 2 + 1]
                    else
                        AY8912_VolA = AY8912_VolTable2[0];
                }
                break;

            case AY_BVOL:

                AY8912_Regs[AY_BVOL] = AY8912_Regs[AY_BVOL] & 0x1F;

                AY8912_EnvelopeB = AY8912_Regs[AY_BVOL] & 0x10;

                if (AY8912_EnvelopeB != 0)
                    AY8912_VolB = AY8912_VolE
                else {
                    if (AY8912_Regs[AY_BVOL] != 0)
                        AY8912_VolB = AY8912_VolTable2[AY8912_Regs[AY_BVOL] * 2 + 1]
                    else
                        AY8912_VolB = AY8912_VolTable2[0];
                };
                break;

            case AY_CVOL:

                AY8912_Regs[AY_CVOL] = AY8912_Regs[AY_CVOL] & 0x1F;

                AY8912_EnvelopeC = AY8912_Regs[AY_CVOL] & 0x10;

                if (AY8912_EnvelopeC != 0)
                    AY8912_VolC = AY8912_VolE
                else {
                    if (AY8912_Regs[AY_CVOL] != 0)
                        AY8912_VolC = AY8912_VolTable2[AY8912_Regs[AY_CVOL] * 2 + 1]
                    else
                        AY8912_VolC = AY8912_VolTable2[0];
                };
                break;

            case AY_EFINE:
            case AY_ECOARSE:

                old = AY8912_PeriodE;

                AY8912_PeriodE = Math.round(((AY8912_Regs[AY_EFINE] + (256 * AY8912_Regs[AY_ECOARSE])))
			  * AY8912_UpdateStep);

                if (AY8912_PeriodE == 0)
                    AY8912_PeriodE = Math.round(AY8912_UpdateStep / 2);

                AY8912_CountE = AY8912_CountE + (AY8912_PeriodE - old);

                if (AY8912_CountE <= 0)
                    AY8912_CountE = 1
                break;

            case AY_ESHAPE:

                //'/* envelope shapes:
                //'C AtAlH
                //'0 0 x x  \___
                //'
                //'0 1 x x  /___
                //'
                //'1 0 0 0  \\\\
                //'
                //'1 0 0 1  \___
                //'
                //'1 0 1 0  \/\/
                //'          ___
                //'1 0 1 1  \
                //'
                //'1 1 0 0  ////
                //'          ___
                //'1 1 0 1  /
                //'
                //'1 1 1 0  /\/\
                //'
                //'1 1 1 1  /___
                //'
                //'The envelope counter on the AY-3-8910 has 16 AY_STEPs. On the YM2149 it
                //'has twice the AY_STEPs, happening twice as fast. Since the end result is
                //'just a smoother curve, we always use the YM2149 behaviour.
                //'*/}
                if (AY8912_Regs[AY_ESHAPE] != 0xFF) {
                    AY8912_Regs[AY_ESHAPE] = AY8912_Regs[AY_ESHAPE] & 0xF;

                    if ((AY8912_Regs[AY_ESHAPE] & 0x4) == 0x4)
                        AY8912_Attack = MAXVOL
                    else
                        AY8912_Attack = 0x0;

                    AY8912_Hold = AY8912_Regs[AY_ESHAPE] & 0x1;

                    AY8912_Alternate = AY8912_Regs[AY_ESHAPE] & 0x2;

                    AY8912_CountE = AY8912_PeriodE;

                    AY8912_CountEnv = MAXVOL; // &h1f

                    AY8912_Holding = 0;

                    AY8912_VolE = AY8912_VolTable2[AY8912_CountEnv ^ AY8912_Attack];

                    if (AY8912_EnvelopeA != 0)
                        AY8912_VolA = AY8912_VolE;

                    if (AY8912_EnvelopeB != 0)
                        AY8912_VolB = AY8912_VolE;

                    if (AY8912_EnvelopeC != 0)
                        AY8912_VolC = AY8912_VolE;
                }
                break;
        }
    }

    function AYReadReg(r) {
        return AY8912_Regs[r];
    }


    function AY8912_init(clock, sample_rate, sample_bits) {
        AY8912_sampleRate = sample_rate;
        AY8912_set_clock(clock);
        AY8912_set_volume(255, 12);
        AY8912_reset();
        return 0;
    }

    function AY8912Update_8() {
        var Buffer_Length = 400;

        //  The 8910 has three outputs, each output is the mix of one of the three 
        //  tone generators and of the (single) noise generator. The two are mixed 
        //  BEFORE going into the DAC. The formula to mix each channel is: 
        //  (ToneOn | ToneDisable) & (NoiseOn | NoiseDisable). 
        //  Note that this means that if both tone and noise are disabled, the output 
        //  is 1, not 0, and can be modulated changing the volume. 
        //  if the channels are disabled, set their output to 1, and increase the 
        //  counter, if necessary, so they will not be inverted during this update. 
        //  Setting the output to 1 is necessary because a disabled channel is locked 
        //  into the ON state (see above); and it has no effect if the volume is 0. 
        //  if the volume is 0, increase the counter, but don't touch the output. 

        if ((AY8912_Regs[AY_ENABLE] & 0x1) == 0x1) {

            if (AY8912_CountA <= (Buffer_Length * AY_STEP))
                AY8912_CountA = AY8912_CountA + (Buffer_Length * AY_STEP);

            AY8912_OutputA = 1;
        }
        else if (AY8912_Regs[AY_AVOL] == 0) {

            // note that I do count += Buffer_Length, NOT count = Buffer_Length + 1. You might think
            // it's the same since the volume is 0, but doing the latter could cause
            // interferencies when the program is rapidly modulating the volume.
            if (AY8912_CountA <= (Buffer_Length * AY_STEP))
                AY8912_CountA = AY8912_CountA + (Buffer_Length * AY_STEP);
        }

        if ((AY8912_Regs[AY_ENABLE] & 0x2) == 0x2) {

            if (AY8912_CountB <= (Buffer_Length * AY_STEP))
                AY8912_CountB = AY8912_CountB + (Buffer_Length * AY_STEP);

            AY8912_OutputB = 1;
        }
        else if (AY8912_Regs[AY_BVOL] == 0) {
            if (AY8912_CountB <= (Buffer_Length * AY_STEP))
                AY8912_CountB = AY8912_CountB + (Buffer_Length * AY_STEP);
        }

        if ((AY8912_Regs[AY_ENABLE] & 0x4) == 0x4) {
            if (AY8912_CountC <= (Buffer_Length * AY_STEP))
                AY8912_CountC = AY8912_CountC + (Buffer_Length * AY_STEP);

            AY8912_OutputC = 1;
        }
        else if ((AY8912_Regs[AY_CVOL] == 0)) {
            if (AY8912_CountC <= (Buffer_Length * AY_STEP))
                AY8912_CountC = AY8912_CountC + (Buffer_Length * AY_STEP);
        }

        // for the noise channel we must not touch OutputN - it's also not necessary 
        // since we use AY_OutNoise. 
        if ((AY8912_Regs[AY_ENABLE] & 0x38) == 0x38) { // all off 
            if (AY8912_CountN <= (Buffer_Length * AY_STEP))
                AY8912_CountN = AY8912_CountN + (Buffer_Length * AY_STEP);
        }

        AY_OutNoise = (AY8912_OutputN | AY8912_Regs[AY_ENABLE]);
    }

    function RenderSample() {

        var VolA, VolB, VolC, AY_Left, lOut1, lOut2, lOut3, AY_NextEvent;

        VolA = 0; VolB = 0; VolC = 0;

        //vola, volb and volc keep track of how long each square wave stays
        //in the 1 position during the sample period.

        AY_Left = AY_STEP;

        do {
            AY_NextEvent = 0;

            if (AY8912_CountN < AY_Left)
                AY_NextEvent = AY8912_CountN
            else
                AY_NextEvent = AY_Left;

            if ((AY_OutNoise & 0x8) == 0x8) {
                if (AY8912_OutputA == 1) VolA = VolA + AY8912_CountA;

                AY8912_CountA = AY8912_CountA - AY_NextEvent;

                //PeriodA is the half period of the square wave. Here, in each
                // loop I add PeriodA twice, so that at the end of the loop the
                // square wave is in the same status (0 or 1) it was at the start.
                // vola is also incremented by PeriodA, since the wave has been 1
                // exactly half of the time, regardless of the initial position.
                // If we exit the loop in the middle, OutputA has to be inverted
                // and vola incremented only if the exit status of the square
                // wave is 1.

                while (AY8912_CountA <= 0) {
                    AY8912_CountA = AY8912_CountA + AY8912_PeriodA;
                    if (AY8912_CountA > 0) {
                        if ((AY8912_Regs[AY_ENABLE] & 1) == 0) AY8912_OutputA = AY8912_OutputA ^ 1;
                        if (AY8912_OutputA != 0) VolA = VolA + AY8912_PeriodA;
                        break;
                    }

                    AY8912_CountA = AY8912_CountA + AY8912_PeriodA;
                    VolA = VolA + AY8912_PeriodA;
                }
                if (AY8912_OutputA == 1) VolA = VolA - AY8912_CountA;
            }
            else {
                AY8912_CountA = AY8912_CountA - AY_NextEvent;

                while (AY8912_CountA <= 0) {
                    AY8912_CountA = AY8912_CountA + AY8912_PeriodA;
                    if (AY8912_CountA > 0) {
                        AY8912_OutputA = AY8912_OutputA ^ 1;
                        break;
                    }
                    AY8912_CountA = AY8912_CountA + AY8912_PeriodA;
                }
            }

            if ((AY_OutNoise & 0x10) == 0x10) {
                if (AY8912_OutputB == 1) VolB = VolB + AY8912_CountB;
                AY8912_CountB = AY8912_CountB - AY_NextEvent;

                while (AY8912_CountB <= 0) {
                    AY8912_CountB = AY8912_CountB + AY8912_PeriodB;
                    if (AY8912_CountB > 0) {
                        if ((AY8912_Regs[AY_ENABLE] & 2) == 0) AY8912_OutputB = AY8912_OutputB ^ 1;
                        if (AY8912_OutputB != 0) VolB = VolB + AY8912_PeriodB;
                        break;
                    }
                    AY8912_CountB = AY8912_CountB + AY8912_PeriodB;
                    VolB = VolB + AY8912_PeriodB;
                }
                if (AY8912_OutputB == 1) VolB = VolB - AY8912_CountB;
            }
            else {
                AY8912_CountB = AY8912_CountB - AY_NextEvent;

                while (AY8912_CountB <= 0) {
                    AY8912_CountB = AY8912_CountB + AY8912_PeriodB;
                    if (AY8912_CountB > 0) {
                        AY8912_OutputB = AY8912_OutputB ^ 1;
                        break;
                    }
                    AY8912_CountB = AY8912_CountB + AY8912_PeriodB;
                }
            }

            if ((AY_OutNoise & 0x20) == 0x20) {
                if (AY8912_OutputC == 1) VolC = VolC + AY8912_CountC;
                AY8912_CountC = AY8912_CountC - AY_NextEvent;
                while (AY8912_CountC <= 0) {
                    AY8912_CountC = AY8912_CountC + AY8912_PeriodC;
                    if (AY8912_CountC > 0) {
                        if ((AY8912_Regs[AY_ENABLE] & 4) == 0) AY8912_OutputC = AY8912_OutputC ^ 1;
                        if (AY8912_OutputC != 0) VolC = VolC + AY8912_PeriodC;
                        break;
                    }

                    AY8912_CountC = AY8912_CountC + AY8912_PeriodC;
                    VolC = VolC + AY8912_PeriodC;
                }
                if (AY8912_OutputC == 1) VolC = VolC - AY8912_CountC;
            }
            else {

                AY8912_CountC = AY8912_CountC - AY_NextEvent;
                while (AY8912_CountC <= 0) {
                    AY8912_CountC = AY8912_CountC + AY8912_PeriodC;
                    if (AY8912_CountC > 0) {
                        AY8912_OutputC = AY8912_OutputC ^ 1;
                        break;
                    }
                    AY8912_CountC = AY8912_CountC + AY8912_PeriodC;
                }
            }

            AY8912_CountN = AY8912_CountN - AY_NextEvent;
            if (AY8912_CountN <= 0) {
                //Is noise output going to change?
                AY8912_OutputN = Math.round(Math.random() * 510);
                AY_OutNoise = (AY8912_OutputN | AY8912_Regs[AY_ENABLE]);
                AY8912_CountN = AY8912_CountN + AY8912_PeriodN;
            }

            AY_Left = AY_Left - AY_NextEvent;
        } while (AY_Left > 0);


        if (AY8912_Holding == 0) {
            AY8912_CountE = AY8912_CountE - AY_STEP;
            if (AY8912_CountE <= 0) {
                do {
                    AY8912_CountEnv = AY8912_CountEnv - 1;
                    AY8912_CountE = AY8912_CountE + AY8912_PeriodE;
                }
                while (AY8912_CountE <= 0);

                //check envelope current position
                if (AY8912_CountEnv < 0) {
                    if (AY8912_Hold != 0) {
                        if (AY8912_Alternate != 0) {
                            AY8912_Attack = AY8912_Attack ^ MAXVOL; //0x1f
                        }
                        AY8912_Holding = 1;
                        AY8912_CountEnv = 0;
                    }
                    else {
                        //if CountEnv has looped an odd number of times (usually 1),
                        //invert the output.
                        if ((AY8912_Alternate != 0) & ((AY8912_CountEnv & 0x20) == 0x20)) {
                            AY8912_Attack = AY8912_Attack ^ MAXVOL; //0x1f
                        }

                        AY8912_CountEnv = AY8912_CountEnv & MAXVOL;  //0x1f
                    }

                }

                AY8912_VolE = AY8912_VolTable2[AY8912_CountEnv ^ AY8912_Attack];

                //reload volume
                if (AY8912_EnvelopeA != 0) AY8912_VolA = AY8912_VolE;
                if (AY8912_EnvelopeB != 0) AY8912_VolB = AY8912_VolE;
                if (AY8912_EnvelopeC != 0) AY8912_VolC = AY8912_VolE;
            }
        }


        lOut1 = (VolA * AY8912_VolA) / 65535;
        lOut2 = (VolB * AY8912_VolB) / 65535;
        lOut3 = (VolC * AY8912_VolC) / 65535;

        return (lOut1 + lOut2 + lOut3) / 31;
    }

    function fillBuffer(outputArray) {
        var n = outputArray.length;
        var i = 0;
        var i2 = 0;
        if (!soundEnabled) {
            audioBuffer.length = 0;
            return;
        }

        while ((audioBuffer.length + i) < n) {
            outputArray[i++] = 0;
        }

        while (i < n) {
            outputArray[i++] = audioBuffer[i2++];
        }

        audioBuffer.splice(0, i2);

    }

    function writeSampleData(soundIsEnabled) {
        soundEnabled = soundIsEnabled;
        if (audioBuffer != null) {
            if (!soundEnabled) {
                audioBuffer = new Array();
            }

            if (frameCount >= 5 & audioOutput != null) {
                numberSamplesWritten = audioOutput.mozWriteAudio(audioBuffer);
                audioBuffer.splice(0, numberSamplesWritten);
            }
        }


    }

    function handleAySound(size) {
        if (audioBuffer != null) {
            size = Math.floor(size);
            while (size--) {
                WCount++;
                if (WCount == 25) {
                    AY8912Update_8();
                    WCount = 0;
                }
                audioBuffer.push(RenderSample());
                soundDataFrameBytes++;
            }
        }
    }


    self.startFrame = function () {
        rowCount = 0;
        soundDataFrameBytes = 0;
        frameCount++;
    }

    self.endFrame = function (enabled) {

        handleAySound(sampleRate / 50 - soundDataFrameBytes);
        soundDataFrameBytes = 0;
        if (frameCount++ < 2) return;

        writeSampleData(enabled);
    }

    self.processRow = function () {
        rowCount++
        handleAySound((rowCount * sampleRate / 50 / 313) - soundDataFrameBytes);
    }


    self.reset = function () {
        AY_OutNoise = 0;
        AY8912_init(clock, sampleRate, 8);
    }

    self.selectRegister = function (reg) {
        regSelect = reg;
    }

    self.readRegister = function () {
        return AY8912_Regs[regSelect];
    }

    self.writeRegister = function (val) {

        //should really do this
        //var sound_size = (processor.getTstates() - lastAyAudio) * sampleRate / 50 / display.frameLength;
        //handleAySound(sound_size);			


        AYWriteReg(regSelect, val);
    }

    self.writeRegister2 = function (reg, val) {

        //should really do this
        //var sound_size = (processor.getTstates() - lastAyAudio) * sampleRate / 50 / display.frameLength;
        //handleAySound(sound_size);			


        AYWriteReg(reg, val);
    }


    self.setProcessor = function (p) {
        processor = p;
    }

    return self;
}
