import { isDesktop } from '@/utils/desktopTitleBar';
import { AiActivityLog } from './AiActivityLog';
import { AiClientsSection } from './AiClientsSection';

/** AI page: what AI may do (later), the MCP server and its clients, and the activity log. */
export function AiPage() {
    return (
        <div className="scroll">
            <div className="aiwrap">
                <div className="aihead">
                    <h1>AI</h1>
                    <p>
                        Connect AI clients to Redis Deck and see every call they
                        make.
                    </p>
                </div>
                <div className="aigrid">
                    <div className="aicol" />
                    <div className="aicol">
                        {isDesktop() && <AiClientsSection />}
                    </div>
                </div>
                <AiActivityLog />
            </div>
        </div>
    );
}
