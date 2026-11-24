import { isDesktop } from '@/utils/desktopTitleBar';
import { AiAccessGrid } from './AiAccessGrid';
import { AiActivityLog } from './AiActivityLog';
import { AiClientsSection } from './AiClientsSection';
import { AiToolsSection } from './AiToolsSection';
import { AiMayDoSection } from './AiMayDoSection';

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
                    <div className="aicol">
                        <AiAccessGrid />
                        <AiMayDoSection />
                    </div>
                    <div className="aicol">
                        {isDesktop() && <AiClientsSection />}
                        <AiToolsSection />
                    </div>
                </div>
                <AiActivityLog />
            </div>
        </div>
    );
}
