import { isDesktop } from '@/utils/desktopTitleBar';
import { AiAccessGrid } from './AiAccessGrid';
import { AiActivityLog } from './AiActivityLog';
import { AiAssistantSection } from './AiAssistantSection';
import { AiClientsSection } from './AiClientsSection';
import { AiMayDoSection } from './AiMayDoSection';

/**
 * AI page: the assistant's model, what AI may do, AI clients (Desktop only) and
 * the activity log.
 */
export function AiPage() {
    return (
        <div className="scroll">
            <div className="aiwrap">
                <div className="aihead">
                    <h1>AI</h1>
                    <p>
                        Choose the model behind the AI assistant, decide what AI
                        may do on each Connection, and see every call it makes.
                    </p>
                </div>
                <div className="aigrid">
                    <div className="aicol">
                        <AiAssistantSection />
                        <AiAccessGrid />
                        <AiMayDoSection />
                    </div>
                    <div className="aicol">
                        {isDesktop() && <AiClientsSection />}
                    </div>
                </div>
                <AiActivityLog />
            </div>
        </div>
    );
}
