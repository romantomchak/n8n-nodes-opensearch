import {
	IExecuteFunctions,
	INodeExecutionData,
	NodeConnectionType
} from 'n8n-workflow';
import type { Document } from '@langchain/core/documents';
import type { Embeddings } from '@langchain/core/embeddings';
import type { OpenSearchVectorStore } from '@langchain/community/dist/vectorstores/opensearch';
import type { VectorStoreNodeArgs } from '../utils/types';
import { N8nJsonLoader } from '../utils/N8nJsonLoader';
import { N8nBinaryLoader } from '../utils/N8nBinaryLoader';
import { processDocument } from '../utils/documents';

export async function handleInsertOperation<T extends OpenSearchVectorStore = OpenSearchVectorStore>(
	context: IExecuteFunctions,
	args: VectorStoreNodeArgs<T>,
	embeddings: Embeddings,
): Promise<INodeExecutionData[]> {
	// Get the input items and document data
	const items = context.getInputData();
	const documentInput = (await context.getInputConnectionData(NodeConnectionType.AiDocument, 0)) as
		| N8nJsonLoader
		| N8nBinaryLoader
		| Array<Document<Record<string, unknown>>>;

	const resultData: INodeExecutionData[] = [];

	// Process each input item
	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		// Check if execution is being cancelled
		if (context.getExecutionCancelSignal()?.aborted) {
			break;
		}

		const itemData = items[itemIndex];

		// Process the document from the input
		const processedDocuments = await processDocument(documentInput, itemData, itemIndex);

		// Add the serialized documents to the result
		resultData.push(...processedDocuments.serializedDocuments);

		const vectorStore = await args.getVectorStoreClient(context, embeddings, itemIndex)
		await vectorStore.addDocuments(processedDocuments.processedDocuments)
	}

	return resultData;
}
