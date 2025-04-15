import type { OpenSearchVectorStore } from "@langchain/community/dist/vectorstores/opensearch";
import type { IExecuteFunctions, ISupplyDataFunctions } from "n8n-workflow";
import { Embeddings } from "@langchain/core/embeddings";

export type NodeOperationMode = 'insert' | 'load' | 'retrieve' | 'update' | 'retrieve-as-tool';

export interface VectorStoreNodeArgs<T extends OpenSearchVectorStore = OpenSearchVectorStore> {
	getVectorStoreClient: (
		context: IExecuteFunctions | ISupplyDataFunctions,
		embeddings: Embeddings,
		itemIndex: number,
	) => Promise<T>;
}

export type VectorStoreFieldOptions = {
	vectorFieldName: string;
	textFieldName: string;
	metadataFieldName: string;
}
