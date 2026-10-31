import { BolnaCallLog, PaceStatusResult, SessionState } from '../types/pace';
import { ENV } from '../config/env';

export interface BolnaAgentConfig {
  agent_config: {
    agent_name: string;
    agent_welcome_message: string;
    webhook_url: string;
    agent_type: string;
    tasks: Array<{
      task_type: string;
      toolchain: {
        execution: string;
        pipelines: string[][];
      };
      tools_config: {
        llm_agent: {
          agent_type: string;
          agent_flow_type: string;
          llm_config: {
            provider: string;
            model: string;
            max_tokens: number;
            temperature: number;
          };
        };
        synthesizer: {
          provider: string;
          provider_config: {
            voice: string;
            voice_id: string;
            model: string;
          };
        };
        transcriber: {
          provider: string;
          language: string;
        };
        api_tools: {
          tools: Array<{
            name: string;
            description: string;
            url: string;
            method: string;
            parameters: Record<string, unknown>;
          }>;
        } | null;
      };
    }>;
  };
  agent_prompts: {
    task_1: {
      system_prompt: string;
    };
  };
}

class BolnaService {
  private activeSession: SessionState | null = null;
  private callLogs: BolnaCallLog[] = [];
  private apiKey: string = import.meta.env.VITE_BOLNA_API_KEY ?? 'demo_key';
  private webhookUrl: string = `${ENV.BACKEND_URL}/api/bolna/webhook`;

  constructor() {
    this.initDefaultSession();
  }

  public initDefaultSession() {
    this.activeSession = {
      id: 'sess-blr-mys-8821',
      phone: '+919876543210',
      vehicleClass: 'car',
      sectionId: 'sec-bengaluru-mysuru-1',
      enteredAt: new Date().toISOString(),
      covered_m: 5000,
      lastSpeed_kmh: 110,
      elapsed_s: 150,
      currentPace: {
        state: 'active',
        max_avg_kmh: 90.0,
        alert: 'red',
        checkpoint: 1,
        effectiveLimit_kmh: 96,
        t_min_s: 750,
        elapsed_s: 150,
        covered_m: 5000,
        remaining_m: 15000,
        need_s: 600,
        speed_kmh: 110,
        currentAvg_kmh: 120,
        banked_time_s: -37.5
      },
      updatedAt: new Date().toISOString()
    };
  }

  public getSession(): SessionState | null {
    return this.activeSession;
  }

  public updateSession(covered_m: number, elapsed_s: number, speed_kmh: number, pace: PaceStatusResult) {
    if (!this.activeSession) return;
    this.activeSession = {
      ...this.activeSession,
      covered_m,
      elapsed_s,
      lastSpeed_kmh: speed_kmh,
      currentPace: pace,
      updatedAt: new Date().toISOString()
    };
  }

  public getCallLogs(): BolnaCallLog[] {
    return this.callLogs;
  }

  /**
   * Generates the official Bolna V2 Agent configuration matching Section 9.
   */
  public getAgentPayload(): BolnaAgentConfig {
    return {
      agent_config: {
        agent_name: 'Pace',
        agent_welcome_message: 'Namaste, main Pace hoon. Bangalore-Mysore Expressway par safe compliance ke liye taiyar hain?',
        webhook_url: this.webhookUrl,
        agent_type: 'other',
        tasks: [
          {
            task_type: 'conversation',
            toolchain: {
              execution: 'sequential',
              pipelines: [['transcriber', 'llm', 'synthesizer']]
            },
            tools_config: {
              llm_agent: {
                agent_type: 'simple_llm_agent',
                agent_flow_type: 'streaming',
                llm_config: {
                  provider: 'openai',
                  model: 'gpt-4.1-mini',
                  max_tokens: 150,
                  temperature: 0.2
                }
              },
              synthesizer: {
                provider: 'sarvam',
                provider_config: {
                  voice: 'bulbul:v1',
                  voice_id: 'hi-IN-bulbul',
                  model: 'sarvam-tts'
                }
              },
              transcriber: {
                provider: 'sarvam',
                language: 'hi'
              },
              api_tools: {
                tools: [
                  {
                    name: 'get_pace_status',
                    description: 'Fetch real-time section speed ceiling, alert level and distance remaining',
                    url: `${ENV.BACKEND_URL}/api/sessions/{session_id}/status`,
                    method: 'GET',
                    parameters: {
                      type: 'object',
                      properties: {
                        phone: { type: 'string', description: 'Caller international phone number' }
                      },
                      required: ['phone']
                    }
                  }
                ]
              }
            }
          }
        ]
      },
      agent_prompts: {
        task_1: {
          system_prompt: `You are Pace, a calm riding assistant. Speak in short Hinglish sentences. Never tell the rider to go above the posted limit. When asked about speed, call the status tool and read back the maximum average speed and the alert level. If the tool fails, say you cannot confirm and ask the rider to follow the posted signs. Never ask the rider to use their phone while riding.`
        }
      }
    };
  }

  /**
   * Simulates pre-trip outbound call: POST https://api.bolna.ai/call
   */
  public simulatePreTripCall(sectionName: string, postedLimit: number, safeLimit: number): BolnaCallLog {
    const transcript =
      `Pace: "Namaste! Main Pace hoon. Aapka ride ${sectionName} par shuru hone wala hai. ` +
      `Posted limit ${postedLimit} km/h hai, aur 4% safety margin ke sath effective ceiling ${safeLimit} km/h hai. ` +
      `ANPR gantry dono taraf active hai. Safe ride ke liye all the best!"`;

    const log: BolnaCallLog = {
      id: `call-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      direction: 'outbound',
      type: 'pre_trip',
      transcript,
      status: 'completed',
      speedReported: safeLimit,
      alertReported: 'green'
    };

    this.callLogs.unshift(log);
    return log;
  }

  /**
   * Simulates hands-free pace query: "Mera max speed kitna hona chahiye?"
   * Executes tool get_pace_status
   */
  public simulatePaceQuery(pace: PaceStatusResult): BolnaCallLog {
    let reply = '';
    if (pace.state === 'done') {
      reply = `Pace: "Aapka enforcement section complete ho chuka hai! Aapka average speed ${pace.currentAvg_kmh} km/h raha. Zero challan!"`;
    } else if (pace.alert === 'red') {
      reply = `Pace: "Dhyan deinge! Aapki speed ${Math.round(pace.speed_kmh)} km/h hai. Alert level RED hai! ` +
        `Challan se bachne ke liye baaki ${Math.round(pace.remaining_m / 1000 * 10) / 10} km mein aapko maximum ${pace.max_avg_kmh} km/h par chalna hoga."`;
    } else if (pace.alert === 'amber') {
      reply = `Pace: "Caution! Aapki speed ${Math.round(pace.speed_kmh)} km/h hai aur ceiling ${pace.max_avg_kmh} km/h hai. ` +
        `Alert level AMBER hai. Speed ko ${pace.max_avg_kmh} ke niche maintain karein."`;
    } else {
      reply = `Pace: "Aapka pace bilkul green hai! Aap ${Math.round(pace.speed_kmh)} km/h pe hain. ` +
        `Aap baaki section mein ${pace.max_avg_kmh} km/h tak chal sakte hain. Bilkul safe!"`;
    }

    const log: BolnaCallLog = {
      id: `call-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      direction: 'inbound',
      type: 'pace_query',
      transcript: `Rider: "Mera max speed kitna hona chahiye?"\n${reply}`,
      status: 'completed',
      speedReported: pace.max_avg_kmh || pace.speed_kmh,
      alertReported: pace.alert
    };

    this.callLogs.unshift(log);
    return log;
  }

  /**
   * Simulates post-trip completion call / SMS webhook
   */
  public simulatePostTripCall(avgSpeed: number, elapsed_s: number, distance_km: number, isLegal: boolean): BolnaCallLog {
    const mins = Math.floor(elapsed_s / 60);
    const secs = elapsed_s % 60;
    const timeStr = `${mins}m ${secs}s`;

    const transcript = isLegal
      ? `Pace: "Badhai ho! Aapne ${distance_km} km section ${timeStr} mein complete kiya. ` +
        `Aapka final average speed ${avgSpeed} km/h raha jo legal limit ke andar hai. ZERO CHALLAN! Shandaar compliance."`
      : `Pace: "Attention! Section ${timeStr} mein poora hua. Average speed ${avgSpeed} km/h rahi, ` +
        `jo 96 km/h safety limit se zyada hai. Challan generate hone ka risk hai."`;

    const log: BolnaCallLog = {
      id: `call-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      direction: 'outbound',
      type: 'post_trip',
      transcript,
      status: 'completed',
      speedReported: avgSpeed,
      alertReported: isLegal ? 'green' : 'red'
    };

    this.callLogs.unshift(log);
    return log;
  }
}

export const bolnaService = new BolnaService();
