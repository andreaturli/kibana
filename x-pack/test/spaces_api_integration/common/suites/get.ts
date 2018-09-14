/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import expect from 'expect.js';
import { SuperAgent } from 'superagent';
import { getUrlPrefix } from '../lib/space_test_utils';
import { DescribeFn, TestDefinitionAuthentication } from '../lib/types';

interface GetTest {
  statusCode: number;
  response: (resp: any) => void;
}

interface GetTests {
  default: GetTest;
}

interface GetTestDefinition {
  auth?: TestDefinitionAuthentication;
  currentSpaceId: string;
  spaceId: string;
  tests: GetTests;
}

export function getTestSuiteFactory(esArchiver: any, supertest: SuperAgent<any>) {
  const nonExistantSpaceId = 'not-a-space';

  const makeGetTest = (describeFn: DescribeFn) => (
    description: string,
    { auth = {}, currentSpaceId, spaceId, tests }: GetTestDefinition
  ) => {
    describeFn(description, () => {
      before(() => esArchiver.load('saved_objects/spaces'));
      after(() => esArchiver.unload('saved_objects/spaces'));

      it(`should return ${tests.default.statusCode}`, async () => {
        return supertest
          .get(`${getUrlPrefix(currentSpaceId)}/api/spaces/space/${spaceId}`)
          .auth(auth.username, auth.password)
          .expect(tests.default.statusCode)
          .then(tests.default.response);
      });
    });
  };

  const getTest = makeGetTest(describe);
  // @ts-ignore
  getTest.only = makeGetTest(describe);

  const createExpectResults = (spaceId: string) => (resp: any) => {
    const allSpaces = [
      {
        id: 'default',
        name: 'Default Space',
        description: 'This is the default space',
        _reserved: true,
      },
      {
        id: 'space_1',
        name: 'Space 1',
        description: 'This is the first test space',
      },
      {
        id: 'space_2',
        name: 'Space 2',
        description: 'This is the second test space',
      },
    ];
    expect(resp.body).to.eql(allSpaces.find(space => space.id === spaceId));
  };

  const createExpectEmptyResult = () => (resp: any) => {
    expect(resp.body).to.eql('');
  };

  const createExpectNotFoundResult = () => (resp: any) => {
    expect(resp.body).to.eql({
      error: 'Not Found',
      statusCode: 404,
    });
  };

  const createExpectRbacForbidden = (spaceId: string) => (resp: any) => {
    expect(resp.body).to.eql({
      statusCode: 403,
      error: 'Forbidden',
      message: `Unauthorized to get ${spaceId} space`,
    });
  };

  const createExpectLegacyForbidden = (username: string) => (resp: any) => {
    expect(resp.body).to.eql({
      statusCode: 403,
      error: 'Forbidden',
      message: `action [indices:data/read/get] is unauthorized for user [${username}]: [security_exception] action [indices:data/read/get] is unauthorized for user [${username}]`,
    });
  };

  return {
    getTest,
    nonExistantSpaceId,
    createExpectResults,
    createExpectRbacForbidden,
    createExpectEmptyResult,
    createExpectNotFoundResult,
    createExpectLegacyForbidden,
  };
}