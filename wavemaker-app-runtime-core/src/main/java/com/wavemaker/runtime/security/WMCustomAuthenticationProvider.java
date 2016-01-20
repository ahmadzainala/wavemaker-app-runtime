package com.wavemaker.runtime.security;

import com.wavemaker.studio.common.WMRuntimeException;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.configurers.ExceptionHandlingConfigurer;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;

import javax.servlet.http.HttpServletRequest;

/**
 * @author Uday Shankar
 */
public class WMCustomAuthenticationProvider implements AuthenticationProvider {

	private WMCustomAuthenticationManager wmCustomAuthenticationManager;

	@Override
	public Authentication authenticate(Authentication authentication) throws AuthenticationException {
		if (authentication instanceof UsernamePasswordAuthenticationToken) {
			UsernamePasswordAuthenticationToken usernamePasswordAuthenticationToken = (UsernamePasswordAuthenticationToken) authentication;
			String username = (String) usernamePasswordAuthenticationToken.getPrincipal();
			String password = (String) usernamePasswordAuthenticationToken.getCredentials();
			Object details = usernamePasswordAuthenticationToken.getDetails();
			if (WMWebAuthenticationDetails.class.isAssignableFrom(details.getClass())) {
				WMWebAuthenticationDetails wmWebAuthenticationDetails = (WMWebAuthenticationDetails) details;
				HttpServletRequest httpServletRequest = wmWebAuthenticationDetails.getHttpServletRequest();
				wmWebAuthenticationDetails.clearLoginRequestDetails();// TODO use a better way to clear request from authentication object
				AuthRequestContext authRequestContext = new AuthRequestContext(username, password, httpServletRequest);
				try {
					WMUser wmUser = wmCustomAuthenticationManager.authenticate(authRequestContext);
					if (wmUser == null) {
						throw new BadCredentialsException("Invalid credentials");
					}
					return new UsernamePasswordAuthenticationToken(wmUser.getUsername(), null, wmUser.getAuthorities());
				} catch (AuthenticationException e) {
					throw e;
				} catch (Exception e) {
					throw new AuthenticationServiceException("Error while authenticating user", e);
				}
			} else {
				return null;
			}
		} else {
			throw new IllegalArgumentException("Authentication type of class [" + authentication.getClass() + "] is not supported by this class");
		}
	}

	@Override
	public boolean supports(Class<?> authentication) {
		return (UsernamePasswordAuthenticationToken.class.isAssignableFrom(authentication));
	}

	public void setWmCustomAuthenticationManager(WMCustomAuthenticationManager wmCustomAuthenticationManager) {
		this.wmCustomAuthenticationManager = wmCustomAuthenticationManager;
	}
}
