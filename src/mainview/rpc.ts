import { Electroview } from "electrobun/view";
import { type DataManagerRPCSchema } from "../shared/types";

const rpc = Electroview.defineRPC<DataManagerRPCSchema>({
	handlers: {
		requests: {},
		messages: {
			logToWebview: ({ msg }) => {
				console.log(`[Bun Log]: ${msg}`);
			},
		},
	},
});

export const electroview = new Electroview({ rpc });
export type RPCType = typeof rpc;
export const request = rpc.request;
export const send = rpc.send;
