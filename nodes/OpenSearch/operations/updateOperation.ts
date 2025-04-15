import {
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError
} from 'n8n-workflow';
import type { Embeddings } from '@langchain/core/embeddings';
import type { OpenSearchVectorStore } from '@langchain/community/dist/vectorstores/opensearch';
import type { VectorStoreNodeArgs } from '../utils/types';
import { N8nJsonLoader } from '../utils/N8nJsonLoader';
import { processDocument } from '../utils/documents';

export async function handleUpdateOperation<T extends OpenSearchVectorStore = OpenSearchVectorStore>(
	context: IExecuteFunctions,
	args: VectorStoreNodeArgs<T>,
	embeddings: Embeddings,
): Promise<INodeExecutionData[]> {
	// Get input items
	const items = context.getInputData();
	// Create a loader for processing document data
	const loader = new N8nJsonLoader(context);

	const resultData: INodeExecutionData[] = [];

	// Process each input item
	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		const itemData = items[itemIndex];

		// Get the document ID to update
		const documentId = context.getNodeParameter('id', itemIndex, '', {
			extractValue: true,
		}) as string;

		// Get the vector store client
		const vectorStore = await args.getVectorStoreClient(context, embeddings, itemIndex);

		// Process the document from the input
		const { processedDocuments, serializedDocuments } = await processDocument(
			loader,
			itemData,
			itemIndex,
		);

		// Validate that we have exactly one document to update
		if (processedDocuments?.length !== 1) {
			throw new NodeOperationError(context.getNode(), 'Single document per item expected');
		}

		// Add the serialized document to the result
		resultData.push(...serializedDocuments);

		const texts = processedDocuments.map(({ pageContent }) => pageContent);
		// Use document ID to update the existing document
		await vectorStore.addVectors(await embeddings.embedDocuments(texts), processedDocuments, {
			ids: [documentId],
		});
	}

	return resultData;
}
