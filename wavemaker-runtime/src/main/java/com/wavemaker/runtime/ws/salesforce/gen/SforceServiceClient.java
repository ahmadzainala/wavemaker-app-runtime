/**
 * Copyright (C) 2014 WaveMaker, Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.wavemaker.runtime.ws.salesforce.gen;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.xml.namespace.QName;
import javax.xml.ws.Service;
import javax.xml.ws.WebEndpoint;
import javax.xml.ws.WebServiceClient;
import javax.xml.ws.WebServiceFeature;
import java.net.MalformedURLException;
import java.net.URL;

/**
 * Sforce SOAP API
 * 
 * This class was generated by the JAX-WS RI. JAX-WS RI 2.1.5-b03- Generated source version: 2.1
 */
@WebServiceClient(name = "SforceService", targetNamespace = "urn:partner.soap.sforce.com", wsdlLocation = "partner.wsdl")
public class SforceServiceClient extends Service {

    private final static URL SFORCESERVICE_WSDL_LOCATION;

    private final static Logger logger = LoggerFactory.getLogger(com.wavemaker.runtime.ws.salesforce.gen.SforceServiceClient.class.getName());

    static {
        URL url = null;
        try {
            URL baseUrl;
            baseUrl = com.wavemaker.runtime.ws.salesforce.gen.SforceServiceClient.class.getResource(".");
            url = new URL(baseUrl, "partner.wsdl");
        } catch (MalformedURLException e) {
            logger.warn("Failed to create URL for the wsdl Location: 'partner.wsdl', retrying as a local file");
            logger.warn(e.getMessage());
        }
        SFORCESERVICE_WSDL_LOCATION = url;
    }

    public SforceServiceClient(URL wsdlLocation, QName serviceName) {
        super(wsdlLocation, serviceName);
    }

    public SforceServiceClient() {
        super(SFORCESERVICE_WSDL_LOCATION, new QName("urn:partner.soap.sforce.com", "SforceService"));
    }

    /**
     * 
     * @return returns Soap
     */
    @WebEndpoint(name = "Soap")
    public Soap getSoap() {
        return super.getPort(new QName("urn:partner.soap.sforce.com", "Soap"), Soap.class);
    }

    /**
     * 
     * @param features A list of {@link javax.xml.ws.WebServiceFeature} to configure on the proxy. Supported features
     *        not in the <code>features</code> parameter will have their default values.
     * @return returns Soap
     */
    @WebEndpoint(name = "Soap")
    public Soap getSoap(WebServiceFeature... features) {
        return super.getPort(new QName("urn:partner.soap.sforce.com", "Soap"), Soap.class, features);
    }

}
